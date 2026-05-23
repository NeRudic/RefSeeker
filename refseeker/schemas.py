from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid
from typing import Optional


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
    user: Optional[UserResponse] = None
    usage_today: int = 0
    daily_limit: int = 1
    remaining: int = 0
    max_images: int = 50
