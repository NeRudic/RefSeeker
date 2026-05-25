import uuid
from datetime import date, datetime

from pydantic import BaseModel, field_validator

from .config import MAX_IMAGES_DEFAULT

# ── Auth ────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime
    usage_today: int = 0
    daily_limit: int

    model_config = {"from_attributes": True}


class RegisterResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Admin ───────────────────────────────────────────────────────────────


class UpdateRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"free", "pro", "premium", "admin"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime
    usage_today: int = 0
    daily_limit: int

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int
    page: int
    per_page: int


# ── Rate limit ──────────────────────────────────────────────────────────


class MeResponse(BaseModel):
    authenticated: bool
    user: UserResponse | None = None
    usage_today: int = 0
    daily_limit: int = 1
    remaining: int = 0
    max_images: int = MAX_IMAGES_DEFAULT


# ── Usage Dashboard ────────────────────────────────────────────────────


class DailyPoint(BaseModel):
    date: str
    count: int


class RoleCount(BaseModel):
    role: str
    count: int


class UsageSummaryResponse(BaseModel):
    total_requests: int
    total_users: int
    total_collections: int
    active_users_today: int
    requests_per_day: list[DailyPoint]
    users_per_day: list[DailyPoint]
    role_distribution: list[RoleCount]
    collections_per_day: list[DailyPoint]


class UserUsageResponse(BaseModel):
    email: str
    role: str
    daily_limit: int
    created_at: datetime
    total_requests_in_period: int
    requests_per_day: list[DailyPoint]


class UsageSummaryParams(BaseModel):
    from_date: date | None = None
    to_date: date | None = None


class UserUsageParams(BaseModel):
    email: str | None = None
    from_date: date | None = None
    to_date: date | None = None
