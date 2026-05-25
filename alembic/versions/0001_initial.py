"""initial migration — create users and request_logs tables

Revision ID: 0001
Revises:
Create Date: 2026-05-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('free', 'pro', 'premium', 'admin')", name="ck_user_role"),
    )

    op.create_table(
        "request_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index(
        "idx_request_logs_user_date",
        "request_logs",
        ["user_id", "date"],
        postgresql_where=sa.text("user_id IS NOT NULL"),
        unique=True,
    )
    op.create_index(
        "idx_request_logs_ip_date",
        "request_logs",
        ["ip_address", "date"],
        postgresql_where=sa.text("ip_address IS NOT NULL"),
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("request_logs")
    op.drop_table("users")
