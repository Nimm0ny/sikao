"""Create identity v2 tables for backend rewrite phase 1.

Legacy auth tables remain untouched. This revision only creates the new
identity/auth skeleton tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1001_identity_v2_tables"
down_revision = "0024_mvp_ai_gongkao_study_and_diagnosis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("public_id", name="uq_users_v2_public_id"),
    )

    op.create_table(
        "password_credentials_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_password_credentials_v2_user"),
    )

    op.create_table(
        "email_contacts_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("email", name="uq_email_contacts_v2_email"),
    )
    op.create_index("ix_email_contacts_v2_user", "email_contacts_v2", ["user_id"])

    op.create_table(
        "phone_contacts_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("phone", name="uq_phone_contacts_v2_phone"),
    )
    op.create_index("ix_phone_contacts_v2_user", "phone_contacts_v2", ["user_id"])

    op.create_table(
        "auth_sessions_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token", sa.String(length=128), nullable=False),
        sa.Column("issued_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_v2_token_hash"),
    )
    op.create_index("ix_auth_sessions_v2_user", "auth_sessions_v2", ["user_id"])
    op.create_index("ix_auth_sessions_v2_expires", "auth_sessions_v2", ["expires_at"])

    op.create_table(
        "verification_tokens_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("target_kind", sa.String(length=16), nullable=False),
        sa.Column("target_value", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_verification_tokens_v2_target",
        "verification_tokens_v2",
        ["target_kind", "target_value", "purpose"],
    )


def downgrade() -> None:
    op.drop_index("ix_verification_tokens_v2_target", table_name="verification_tokens_v2")
    op.drop_table("verification_tokens_v2")
    op.drop_index("ix_auth_sessions_v2_expires", table_name="auth_sessions_v2")
    op.drop_index("ix_auth_sessions_v2_user", table_name="auth_sessions_v2")
    op.drop_table("auth_sessions_v2")
    op.drop_index("ix_phone_contacts_v2_user", table_name="phone_contacts_v2")
    op.drop_table("phone_contacts_v2")
    op.drop_index("ix_email_contacts_v2_user", table_name="email_contacts_v2")
    op.drop_table("email_contacts_v2")
    op.drop_table("password_credentials_v2")
    op.drop_table("users_v2")
