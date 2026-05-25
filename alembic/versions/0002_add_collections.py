"""add collections table

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "collections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("folder_name", sa.String(255), nullable=False, unique=True),
        sa.Column("query", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Backfill existing collections from filesystem (orphaned — user_id = NULL)
    import os

    references_dir = os.path.join(".", "references")
    if os.path.isdir(references_dir):
        conn = op.get_bind()
        for entry in os.listdir(references_dir):
            full_path = os.path.join(references_dir, entry)
            if os.path.isdir(full_path) and not entry.startswith("."):
                query = entry.replace("_", " ").strip()
                conn.execute(
                    sa.text(
                        "INSERT INTO collections (folder_name, query) VALUES (:folder, :query) "
                        "ON CONFLICT (folder_name) DO NOTHING"
                    ),
                    {"folder": entry, "query": query},
                )


def downgrade() -> None:
    op.drop_table("collections")
