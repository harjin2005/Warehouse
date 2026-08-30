"""initial schema: tenants and users

Revision ID: 0001
Revises:
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(50), nullable=False, server_default="trial"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(1024), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "is_superuser", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_verified", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("tenants")
