import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .admin import router as admin_router
from .agent import run_agent
from .auth import create_access_token, create_refresh_token, decode_token, get_client_ip, get_current_user, get_optional_user, hash_password, verify_password
from .config import IMAGE_BLACKLIST, logger, update_image_blacklist
from .database import async_session_factory, engine, get_db
from .models import Collection, User
from .progress import ProgressTracker
from .rate_limit import check_and_increment_rate_limit, get_daily_limit, get_usage_today
from .schemas import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)

# ── Session store ───────────────────────────────────────────────────────────

_sessions: dict[str, ProgressTracker] = {}
REFERENCES_DIR = Path("references")

# ── FastAPI app ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="RefSeeker API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ─────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    query: str
    max_images: int = 50
    blacklist: list[str] = []


class CreateSessionResponse(BaseModel):
    session_id: str


# ── API endpoints ───────────────────────────────────────────────────────────

@app.post("/api/sessions", response_model=CreateSessionResponse)
async def create_session(
    body: CreateSessionRequest,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new image search session (rate-limited)."""
    ip = get_client_ip(request)
    remaining = await check_and_increment_rate_limit(user, ip, db)

    session_id = uuid.uuid4().hex
    tracker = ProgressTracker(session_id)
    _sessions[session_id] = tracker

    logger.info(
        "Session %s started: query=%s max=%d user=%s remaining=%d",
        session_id, body.query, body.max_images,
        user.email if user else "anonymous", remaining,
    )

    asyncio.create_task(_run_pipeline(session_id, tracker, body.query, body.max_images, user, body.blacklist))

    return CreateSessionResponse(session_id=session_id)


@app.get("/api/sessions/{session_id}/stream")
async def stream_session(session_id: str):
    """SSE endpoint for real-time pipeline progress."""
    tracker = _sessions.get(session_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        async for event in tracker.subscribe():
            yield f"data: {event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get current session state (or latest known if complete)."""
    tracker = _sessions.get(session_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="Session not found")

    from .state import state
    return {
        "session_id": session_id,
        "query_name": state.query_name,
        "saved_count": state.saved_count,
        "max_images": state.max_images,
        "blacklist": state.blacklist,
        "download_attempts": state.download_attempts,
        "gpt_calls": state.gpt_calls,
        "elapsed": state.elapsed,
        "filter_stats": dict(state.filter_stats),
        "finished": tracker._finished,
    }


@app.get("/api/collections")
async def list_collections(
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List collections visible to the current user."""
    if not REFERENCES_DIR.exists():
        return {"collections": []}

    # Admin sees all; authenticated users see their own; anonymous sees nothing
    if user and user.role == "admin":
        result = await db.execute(select(Collection))
    elif user:
        result = await db.execute(
            select(Collection).where(Collection.user_id == user.id)
        )
    else:
        return {"collections": []}

    db_collections = result.scalars().all()
    folder_map = {c.folder_name: c for c in db_collections}

    collections = []
    for folder in sorted(REFERENCES_DIR.iterdir()):
        if not folder.is_dir() or folder.name not in folder_map:
            continue
        images = sorted(folder.iterdir()) if folder.exists() else []
        collections.append({
            "name": folder.name,
            "path": str(folder),
            "image_count": len(images),
            "thumbnail": _get_thumbnail(folder, images),
        })

    return {"collections": collections}


@app.get("/api/collections/{name}")
async def get_collection(
    name: str,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List images in a collection."""
    folder = REFERENCES_DIR / name
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Collection not found")

    # Check access
    result = await db.execute(
        select(Collection).where(Collection.folder_name == name)
    )
    db_collection = result.scalar_one_or_none()
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not _can_access_collection(db_collection, user):
        raise HTTPException(status_code=404, detail="Collection not found")

    images = []
    for img in sorted(folder.iterdir()):
        if img.is_file():
            images.append({
                "filename": img.name,
                "path": f"/api/collections/{name}/images/{img.name}",
                "size": img.stat().st_size,
            })

    return {"name": name, "images": images}


@app.get("/api/collections/{name}/images/{filename}")
async def get_collection_image(name: str, filename: str):
    """Serve an image file from a collection."""
    file_path = REFERENCES_DIR / name / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(file_path))


@app.delete("/api/collections/{name}")
async def delete_collection(
    name: str,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an entire collection (owner or admin only)."""
    folder = REFERENCES_DIR / name
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Collection not found")

    # Check access
    result = await db.execute(
        select(Collection).where(Collection.folder_name == name)
    )
    db_collection = result.scalar_one_or_none()
    if not db_collection or not _can_access_collection(db_collection, user):
        raise HTTPException(status_code=404, detail="Collection not found")

    import shutil
    await db.delete(db_collection)
    shutil.rmtree(folder)
    logger.info("Deleted collection: %s", name)
    return {"deleted": name}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Auth endpoints ──────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=RegisterResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="free",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    ip = "0.0.0.0"
    usage = await get_usage_today(user, ip, db)
    return RegisterResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            usage_today=usage,
            daily_limit=get_daily_limit(user),
        ),
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    ip = "0.0.0.0"
    usage = await get_usage_today(user, ip, db)
    return LoginResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            usage_today=usage,
            daily_limit=get_daily_limit(user),
        ),
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@app.get("/api/auth/me")
async def me(
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    if user is None:
        return MeResponse(
            authenticated=False,
            usage_today=0,
            daily_limit=1,
            remaining=1,
        )

    usage = await get_usage_today(user, ip, db)
    limit = get_daily_limit(user)
    remaining = max(0, limit - usage) if limit != -1 else 999999
    return MeResponse(
        authenticated=True,
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
            usage_today=usage,
            daily_limit=limit,
        ),
        usage_today=usage,
        daily_limit=limit,
        remaining=remaining,
    )


# ── Admin router ────────────────────────────────────────────────────────────

app.include_router(admin_router)


# ── Settings ─────────────────────────────────────────────────────────────────

class UpdateBlacklistRequest(BaseModel):
    items: list[str]


@app.get("/api/settings/blacklist")
async def get_blacklist():
    """Return the current image blacklist."""
    return {"items": list(IMAGE_BLACKLIST)}


@app.post("/api/settings/blacklist")
async def set_blacklist(body: UpdateBlacklistRequest):
    """Replace the image blacklist with a new set of items."""
    items = [item.strip() for item in body.items if item.strip()]
    update_image_blacklist(items)
    logger.info("Blacklist updated: %d items", len(items))
    return {"items": list(IMAGE_BLACKLIST)}


# ── Background pipeline runner ──────────────────────────────────────────────

async def _run_pipeline(session_id: str, tracker: ProgressTracker, query: str, max_images: int, user: User | None = None, blacklist: list[str] | None = None):
    """Run the full pipeline and push progress events."""
    collection_id = uuid.uuid4()
    try:
        tracker.search_started(query=query, max_images=max_images)
        await run_agent(query, max_images, progress_tracker=tracker, blacklist=blacklist, collection_id=collection_id.hex)
        from .state import state
        tracker.session_complete(metrics={
            "saved": state.saved_count,
            "max": state.max_images,
            "downloads": state.download_attempts,
            "gpt_calls": state.gpt_calls,
            "elapsed": state.elapsed,
            "filters": dict(state.filter_stats),
        })

        # Save collection record (using the pre-generated UUID as PK)
        if state.saved_count > 0:
            async with async_session_factory() as db_session:
                try:
                    db_session.add(Collection(
                        id=collection_id,
                        user_id=user.id if user else None,
                        folder_name=state.query_folder,
                        query=state.query_name,
                    ))
                    await db_session.commit()
                    logger.info("Collection saved: %s (user=%s)", state.query_folder, user.id if user else "anonymous")
                except Exception as e:
                    await db_session.rollback()
                    logger.warning("Failed to save collection record: %s", e)

    except Exception as e:
        logger.exception("Session %s failed", session_id)
        tracker.session_error(message=str(e))
    finally:
        # Clean up pending images directory
        from .state import state as pipeline_state
        if pipeline_state.output_dir:
            import shutil
            pending_dir = Path(pipeline_state.output_dir) / ".pending"
            if pending_dir.exists():
                shutil.rmtree(pending_dir, ignore_errors=True)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_thumbnail(folder: Path, images: list[Path]) -> str | None:
    """Get the first image as a thumbnail URL for the collection."""
    for img in images:
        if img.is_file():
            return f"/api/collections/{folder.name}/images/{img.name}"
    return None


def _can_access_collection(collection: Collection, user: User | None) -> bool:
    """Check if a user can access a collection (owner or admin)."""
    if user and user.role == "admin":
        return True
    return bool(user and collection.user_id == user.id)
