import math
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_user, require_admin
from .config import DEFAULT_USAGE_DAYS
from .database import get_db
from .models import Collection, RequestLog, User
from .rate_limit import get_daily_limit, get_usage_today
from .schemas import (
    AdminUserListResponse,
    AdminUserResponse,
    DailyPoint,
    RoleCount,
    UpdateRoleRequest,
    UsageSummaryResponse,
    UserUsageResponse,
)

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


# ── Usage Dashboard ──────────────────────────────────────────────────────

def _default_date_range() -> tuple[date, date]:
    """Default to last 30 days if no range specified."""
    today = date.today()
    return today - timedelta(days=DEFAULT_USAGE_DAYS - 1), today


@router.get("/usage/summary", response_model=UsageSummaryResponse)
async def usage_summary(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rd = _default_date_range()
    f = from_date or rd[0]
    t = to_date or rd[1]

    # Total requests in period
    req_result = await db.execute(
        select(func.coalesce(func.sum(RequestLog.request_count), 0))
        .where(RequestLog.date >= f, RequestLog.date <= t)
    )
    total_requests = req_result.scalar() or 0

    # Total registered users
    user_count_result = await db.execute(select(func.count(User.id)))
    total_users = user_count_result.scalar() or 0

    # Total collections
    col_count_result = await db.execute(select(func.count(Collection.id)))
    total_collections = col_count_result.scalar() or 0

    # Active users today
    today = date.today()
    active_result = await db.execute(
        select(func.count(func.distinct(RequestLog.user_id)))
        .where(RequestLog.date == today, RequestLog.user_id.isnot(None))
    )
    active_users_today = active_result.scalar() or 0

    # Requests per day
    req_day_result = await db.execute(
        select(RequestLog.date, func.sum(RequestLog.request_count))
        .where(RequestLog.date >= f, RequestLog.date <= t)
        .group_by(RequestLog.date)
        .order_by(RequestLog.date)
    )
    requests_per_day = [DailyPoint(date=str(row[0]), count=row[1]) for row in req_day_result.all()]

    # Active users per day
    users_day_result = await db.execute(
        select(RequestLog.date, func.count(func.distinct(RequestLog.user_id)))
        .where(RequestLog.date >= f, RequestLog.date <= t, RequestLog.user_id.isnot(None))
        .group_by(RequestLog.date)
        .order_by(RequestLog.date)
    )
    users_per_day = [DailyPoint(date=str(row[0]), count=row[1]) for row in users_day_result.all()]

    # Role distribution
    role_result = await db.execute(
        select(User.role, func.count(User.id))
        .group_by(User.role)
        .order_by(User.role)
    )
    role_distribution = [RoleCount(role=row[0], count=row[1]) for row in role_result.all()]

    # Collections per day
    col_day_result = await db.execute(
        select(cast(Collection.created_at, Date), func.count(Collection.id))
        .where(cast(Collection.created_at, Date) >= f, cast(Collection.created_at, Date) <= t)
        .group_by(cast(Collection.created_at, Date))
        .order_by(cast(Collection.created_at, Date))
    )
    collections_per_day = [DailyPoint(date=str(row[0]), count=row[1]) for row in col_day_result.all()]

    return UsageSummaryResponse(
        total_requests=total_requests,
        total_users=total_users,
        total_collections=total_collections,
        active_users_today=active_users_today,
        requests_per_day=requests_per_day,
        users_per_day=users_per_day,
        role_distribution=role_distribution,
        collections_per_day=collections_per_day,
    )


@router.get("/usage/user", response_model=UserUsageResponse)
async def user_usage(
    email: str | None = Query(None),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rd = _default_date_range()
    f = from_date or rd[0]
    t = to_date or rd[1]

    if email:
        # Find user by email
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Total requests in period for this user
        total_result = await db.execute(
            select(func.coalesce(func.sum(RequestLog.request_count), 0))
            .where(RequestLog.user_id == user.id, RequestLog.date >= f, RequestLog.date <= t)
        )
        total_in_period = total_result.scalar() or 0

        # Requests per day for this user
        day_result = await db.execute(
            select(RequestLog.date, func.sum(RequestLog.request_count))
            .where(RequestLog.user_id == user.id, RequestLog.date >= f, RequestLog.date <= t)
            .group_by(RequestLog.date)
            .order_by(RequestLog.date)
        )
        requests_per_day = [DailyPoint(date=str(row[0]), count=row[1]) for row in day_result.all()]

        return UserUsageResponse(
            email=user.email,
            role=user.role,
            daily_limit=get_daily_limit(user),
            created_at=user.created_at,
            total_requests_in_period=total_in_period,
            requests_per_day=requests_per_day,
        )
    else:
        # Anonymous / unauthorized usage
        total_result = await db.execute(
            select(func.coalesce(func.sum(RequestLog.request_count), 0))
            .where(RequestLog.user_id.is_(None), RequestLog.date >= f, RequestLog.date <= t)
        )
        total_in_period = total_result.scalar() or 0

        day_result = await db.execute(
            select(RequestLog.date, func.sum(RequestLog.request_count))
            .where(RequestLog.user_id.is_(None), RequestLog.date >= f, RequestLog.date <= t)
            .group_by(RequestLog.date)
            .order_by(RequestLog.date)
        )
        requests_per_day = [DailyPoint(date=str(row[0]), count=row[1]) for row in day_result.all()]

        return UserUsageResponse(
            email="__unauthorized__",
            role="anonymous",
            daily_limit=1,
            created_at=datetime.min,
            total_requests_in_period=total_in_period,
            requests_per_day=requests_per_day,
        )
