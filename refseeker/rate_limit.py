from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import RATE_LIMITS
from .models import User


def get_daily_limit(user: User | None) -> int:
    if user is None:
        return RATE_LIMITS.get("unauthenticated", 1)
    return RATE_LIMITS.get(user.role, 0)


async def get_usage_today(user: User | None, ip: str, db: AsyncSession) -> int:
    today = date.today()
    if user:
        result = await db.execute(
            text("SELECT request_count FROM request_logs WHERE user_id = :uid AND date = :today"),
            {"uid": user.id, "today": today},
        )
    else:
        result = await db.execute(
            text("SELECT request_count FROM request_logs WHERE ip_address = :ip AND date = :today AND user_id IS NULL"),
            {"ip": ip, "today": today},
        )
    row = result.scalar_one_or_none()
    return row or 0


async def check_and_increment_rate_limit(
    user: User | None,
    ip: str,
    db: AsyncSession,
) -> int:
    """Check rate limit and increment counter atomically.

    Returns remaining requests after this one is counted.
    Raises HTTP 429 if over limit.
    """
    today = date.today()
    limit = get_daily_limit(user)

    # Admin is unlimited
    if limit == -1:
        return 0

    if user:
        result = await db.execute(
            text(
                "INSERT INTO request_logs (id, user_id, ip_address, date, request_count) "
                "VALUES (gen_random_uuid(), :uid, NULL, :today, 1) "
                "ON CONFLICT (user_id, date) WHERE user_id IS NOT NULL "
                "DO UPDATE SET request_count = request_logs.request_count + 1 "
                "RETURNING request_count"
            ),
            {"uid": user.id, "today": today},
        )
    else:
        result = await db.execute(
            text(
                "INSERT INTO request_logs (id, user_id, ip_address, date, request_count) "
                "VALUES (gen_random_uuid(), NULL, :ip, :today, 1) "
                "ON CONFLICT (ip_address, date) WHERE ip_address IS NOT NULL "
                "DO UPDATE SET request_count = request_logs.request_count + 1 "
                "RETURNING request_count"
            ),
            {"ip": ip, "today": today},
        )

    row = result.one_or_none()
    request_count = row[0] if row else 1

    await db.commit()

    if request_count > limit:
        reset_at = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Daily limit reached. Register or upgrade to continue."
                if user is None
                else f"Daily limit reached ({request_count - 1}/{limit}). Upgrade for more.",
                "limit": limit,
                "used": request_count - 1,
                "remaining": 0,
                "reset_at": reset_at.isoformat(),
            },
        )

    return limit - request_count
