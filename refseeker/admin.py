import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user, require_admin
from .database import get_db
from .models import RequestLog, User
from .rate_limit import get_daily_limit, get_usage_today
from .schemas import AdminUserListResponse, AdminUserResponse, UpdateRoleRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    users = result.scalars().all()

    users_response = []
    for u in users:
        ip = str(u.id)
        usage = await get_usage_today(u, ip, db)
        users_response.append(AdminUserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            created_at=u.created_at,
            usage_today=usage,
            daily_limit=get_daily_limit(u),
        ))

    return AdminUserListResponse(
        users=users_response,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = body.role
    await db.commit()
    await db.refresh(user)

    ip = str(user.id)
    usage = await get_usage_today(user, ip, db)
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        usage_today=usage,
        daily_limit=get_daily_limit(user),
    )
