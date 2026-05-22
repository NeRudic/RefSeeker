import asyncio
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .agent import run_agent
from .config import logger
from .progress import ProgressTracker

# ── Session store ───────────────────────────────────────────────────────────

_sessions: dict[str, ProgressTracker] = {}
REFERENCES_DIR = Path("references")

# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(title="RefSeeker API", version="1.0.0")

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


class CreateSessionResponse(BaseModel):
    session_id: str


# ── API endpoints ───────────────────────────────────────────────────────────

@app.post("/api/sessions", response_model=CreateSessionResponse)
async def create_session(body: CreateSessionRequest):
    """Start a new image search session."""
    session_id = uuid.uuid4().hex
    tracker = ProgressTracker(session_id)
    _sessions[session_id] = tracker

    logger.info("Session %s started: query=%s max=%d", session_id, body.query, body.max_images)

    asyncio.create_task(_run_pipeline(session_id, tracker, body.query, body.max_images))

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
        "download_attempts": state.download_attempts,
        "gpt_calls": state.gpt_calls,
        "elapsed": state.elapsed,
        "filter_stats": dict(state.filter_stats),
        "finished": tracker._finished,
    }


@app.get("/api/collections")
async def list_collections():
    """List all saved collections (folders under references/)."""
    if not REFERENCES_DIR.exists():
        return {"collections": []}

    collections = []
    for folder in sorted(REFERENCES_DIR.iterdir()):
        if not folder.is_dir():
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
async def get_collection(name: str):
    """List images in a collection."""
    folder = REFERENCES_DIR / name
    if not folder.exists() or not folder.is_dir():
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
async def delete_collection(name: str):
    """Delete an entire collection."""
    folder = REFERENCES_DIR / name
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Collection not found")

    import shutil
    shutil.rmtree(folder)
    logger.info("Deleted collection: %s", name)
    return {"deleted": name}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Background pipeline runner ──────────────────────────────────────────────

async def _run_pipeline(session_id: str, tracker: ProgressTracker, query: str, max_images: int):
    """Run the full pipeline and push progress events."""
    try:
        tracker.search_started(query=query, max_images=max_images)
        await run_agent(query, max_images, progress_tracker=tracker)
        from .state import state
        tracker.session_complete(metrics={
            "saved": state.saved_count,
            "max": state.max_images,
            "downloads": state.download_attempts,
            "gpt_calls": state.gpt_calls,
            "elapsed": state.elapsed,
            "filters": dict(state.filter_stats),
        })
    except Exception as e:
        logger.exception("Session %s failed", session_id)
        tracker.session_error(message=str(e))
    finally:
        # Keep session data for a while so clients can fetch final state
        pass


# ── Entry point ─────────────────────────────────────────────────────────────

def _get_thumbnail(folder: Path, images: list[Path]) -> str | None:
    """Get the first image as a thumbnail URL for the collection."""
    for img in images:
        if img.is_file():
            return f"/api/collections/{folder.name}/images/{img.name}"
    return None
