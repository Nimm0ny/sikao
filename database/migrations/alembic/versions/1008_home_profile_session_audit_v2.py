"""Create Home Phase system tables and extend existing v2 tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "1008_home_profile_session_audit_v2"
down_revision = "1007_home_recommendation_v2"
branch_labels = None
depends_on = None

_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")
_LLM_PARSE_FAILED_WHERE = sa.text("parse_status != 'ok'")


def upgrade() -> None:
    op.create_table(
        "idempotency_key_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.String(length=120), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", _JSONB_COMPAT, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("key", "user_id", "endpoint", name="uq_idem_key"),
    )
    op.create_index("ix_idem_expires", "idempotency_key_v2", ["expires_at"])

    op.create_table(
        "llm_call_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_cny", sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("request_payload", _JSONB_COMPAT, nullable=False),
        sa.Column("response_payload", _JSONB_COMPAT, nullable=True),
        sa.Column("parsed_output", _JSONB_COMPAT, nullable=True),
        sa.Column("parse_status", sa.String(length=32), nullable=False),
        sa.Column("error_class", sa.String(length=80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_llm_user_purpose", "llm_call_v2", ["user_id", "purpose", "created_at"])
    op.create_index(
        "ix_llm_parse_failed",
        "llm_call_v2",
        ["parse_status"],
        sqlite_where=_LLM_PARSE_FAILED_WHERE,
        postgresql_where=_LLM_PARSE_FAILED_WHERE,
    )

    op.create_table(
        "audit_log_v2",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("actor_type", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.String(length=40), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("target_type", sa.String(length=40), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("before", _JSONB_COMPAT, nullable=True),
        sa.Column("after", _JSONB_COMPAT, nullable=True),
        sa.Column("diff", _JSONB_COMPAT, nullable=True),
        sa.Column("metadata", _JSONB_COMPAT, nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_user_action_at", "audit_log_v2", ["user_id", "action", "created_at"])
    op.create_index("ix_audit_target", "audit_log_v2", ["target_type", "target_id"])

    with op.batch_alter_table("profile_goals_v2") as batch_op:
        batch_op.add_column(
            sa.Column("exam_targets", _JSONB_COMPAT, nullable=False, server_default=sa.text("'[]'"))
        )
    with op.batch_alter_table("profile_goals_v2") as batch_op:
        batch_op.alter_column("exam_targets", existing_type=_JSONB_COMPAT, server_default=None)

    with op.batch_alter_table("profile_infos_v2") as batch_op:
        batch_op.add_column(
            sa.Column("ai_adjust_enabled", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column("dashboard_preferences", _JSONB_COMPAT, nullable=False, server_default=sa.text("'{}'"))
        )
        batch_op.add_column(
            sa.Column("recommender_preferences", _JSONB_COMPAT, nullable=False, server_default=sa.text("'{}'"))
        )
    with op.batch_alter_table("profile_infos_v2") as batch_op:
        batch_op.alter_column("ai_adjust_enabled", existing_type=sa.Boolean(), server_default=None)
        batch_op.alter_column("dashboard_preferences", existing_type=_JSONB_COMPAT, server_default=None)
        batch_op.alter_column("recommender_preferences", existing_type=_JSONB_COMPAT, server_default=None)

    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.add_column(sa.Column("linked_plan_event_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("linked_recommendation_id", sa.Integer(), nullable=True))
        # FK names trimmed to fit PostgreSQL 63-char identifier limit.
        # The "<col>_<ref_table>" tail is redundant with the table+column
        # already in the prefix, and the longer "_recommendation_v2" form
        # overflowed at 67 chars and crashed `alembic upgrade head` on PG.
        batch_op.create_foreign_key(
            "fk_practice_sessions_v2_linked_plan_event",
            "plan_event_v2",
            ["linked_plan_event_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_practice_sessions_v2_linked_recommendation",
            "recommendation_v2",
            ["linked_recommendation_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_practice_sessions_v2_linked_plan_event", ["linked_plan_event_id"])
        batch_op.create_index("ix_practice_sessions_v2_linked_recommendation", ["linked_recommendation_id"])

    with op.batch_alter_table("plan_adjustment_v2") as batch_op:
        batch_op.add_column(sa.Column("llm_call_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_plan_adjustment_v2_llm_call_id_llm_call_v2",
            "llm_call_v2",
            ["llm_call_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("recommendation_v2") as batch_op:
        batch_op.add_column(sa.Column("llm_call_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_recommendation_v2_llm_call_id_llm_call_v2",
            "llm_call_v2",
            ["llm_call_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("recommendation_v2") as batch_op:
        batch_op.drop_constraint("fk_recommendation_v2_llm_call_id_llm_call_v2", type_="foreignkey")
        batch_op.drop_column("llm_call_id")

    with op.batch_alter_table("plan_adjustment_v2") as batch_op:
        batch_op.drop_constraint("fk_plan_adjustment_v2_llm_call_id_llm_call_v2", type_="foreignkey")
        batch_op.drop_column("llm_call_id")

    with op.batch_alter_table("practice_sessions_v2") as batch_op:
        batch_op.drop_index("ix_practice_sessions_v2_linked_recommendation")
        batch_op.drop_index("ix_practice_sessions_v2_linked_plan_event")
        batch_op.drop_constraint("fk_practice_sessions_v2_linked_recommendation", type_="foreignkey")
        batch_op.drop_constraint("fk_practice_sessions_v2_linked_plan_event", type_="foreignkey")
        batch_op.drop_column("linked_recommendation_id")
        batch_op.drop_column("linked_plan_event_id")

    with op.batch_alter_table("profile_infos_v2") as batch_op:
        batch_op.drop_column("recommender_preferences")
        batch_op.drop_column("dashboard_preferences")
        batch_op.drop_column("ai_adjust_enabled")

    with op.batch_alter_table("profile_goals_v2") as batch_op:
        batch_op.drop_column("exam_targets")

    op.drop_index("ix_audit_target", table_name="audit_log_v2")
    op.drop_index("ix_audit_user_action_at", table_name="audit_log_v2")
    op.drop_table("audit_log_v2")
    op.drop_index("ix_llm_parse_failed", table_name="llm_call_v2")
    op.drop_index("ix_llm_user_purpose", table_name="llm_call_v2")
    op.drop_table("llm_call_v2")
    op.drop_index("ix_idem_expires", table_name="idempotency_key_v2")
    op.drop_table("idempotency_key_v2")
