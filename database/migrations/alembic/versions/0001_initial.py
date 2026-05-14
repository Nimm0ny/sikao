"""Phase 5.4 initial schema (DDL freeze of pre-0002 baseline).

Original 0001 used `Base.metadata.create_all`, which inadvertently created
every 0002+ addition (Question.subject column, wrong_question_masteries
table, ix_questions_subject index, ...). Running `alembic upgrade head` on
a fresh DB then died at 0002 with DuplicateColumn / DuplicateTable.

This rewrite clones Base.metadata into a new MetaData without 0002's
additions and create_all's only that subset. Cross-dialect-safe (no hand-
rolled SQL); no behavior change for existing DBs (alembic_version 已 stamp 过
的环境跳过此 revision)。

Future migrations 0003+: schema changes flow through op.add_column /
op.create_table normally — no more "metadata.create_all eats them" trap.
"""

from __future__ import annotations

from sqlalchemy import MetaData

from alembic import op
from sikao_api.db.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


# 0002+ 引入的 schema 增量 — 0001 必须排除掉，让后续 migration 的 ALTER 真正起作用.
# 0001 用 Base.metadata.to_metadata 克隆现有 model state, 任何新加 column/table
# 都会被克隆吸收, 后续 migration ALTER ADD 撞 already-exists. 维护这个清单是
# to_metadata 路径的成本.
_TABLES_ADDED_IN_LATER = frozenset(
    {
        "wrong_question_masteries",  # 0002
        "auth_tokens",  # 0003
        "exam_events",  # 0006
        "llm_token_usage",  # 0007
        "user_llm_configs",  # 0008
        "llm_conversations",  # 0009
        "llm_messages",  # 0009
        "essay_grading_records",  # 0010
        "study_plans",  # 0011
        "study_plan_tasks",  # 0011
        "user_goals",  # 0013
        "question_notes",  # 0014
        "pre_register_codes",  # 0015 (identity v2)
        "notes",  # 0018 (notebook module, SIKAO Wave 4 Phase 2B)
        "note_reviews",  # 0018 (notebook SM-2 review audit)
        "wrong_question_attempts",  # 0019 (xingce-wrongbook BE, SIKAO Wave 4 Phase 2C)
        "user_exams",  # 0021 (SIKAO Wave 8 Phase A — Home 4-block 用户自定义考试)
        # 0022 (SIKAO Wave 10 Phase A — 笔记本社交化, 4 新表).
        "note_comments",
        "note_likes",
        "note_favorites",
        "note_reports",
        "essay_draft_records",  # 0023 (PR13 P5 — 申论双模草稿持久化)
    }
)
_COLUMNS_ADDED_IN_LATER = frozenset(
    {
        ("questions", "subject"),  # 0002
        ("users", "email"),  # 0003
        ("users", "email_verified"),  # 0003
        ("practice_sessions", "retry_question_ids_json"),  # 0004
        ("users", "phone"),  # 0015 (identity v2)
        ("users", "phone_verified"),  # 0015 (identity v2)
        # 0020 (xingce-wrongbook BE): 扩 wrong_question_masteries 4 字段.
        ("wrong_question_masteries", "error_reasons"),
        ("wrong_question_masteries", "bluff_count"),
        ("wrong_question_masteries", "peek_count"),
        ("wrong_question_masteries", "attempts_json"),
        # 0021 (SIKAO Wave 8 Phase A): study_plans 扩 3 字段 (Home block 4 配额).
        ("study_plans", "daily_quota"),
        ("study_plans", "daily_accuracy_target"),
        ("study_plans", "subject_quotas"),
        # 0022 (SIKAO Wave 10 Phase A): notes 扩 6 字段 (笔记本社交化).
        ("notes", "is_public"),
        ("notes", "public_at"),
        ("notes", "display_anonymous"),
        ("notes", "likes_count"),
        ("notes", "comments_count"),
        ("notes", "question_id"),
    }
)
_INDEXES_ADDED_IN_LATER = frozenset(
    {
        "ix_questions_subject",  # 0002
        "ix_users_email",  # 0003
        "ix_auth_tokens_user_kind",  # 0003
        "ix_users_phone",  # 0015 (identity v2)
        # 0022 (SIKAO Wave 10 Phase A): notes question + 复合 index.
        "ix_notes_question_id",
        "ix_notes_question_public_likes",
        # 0023 (PR13 P5): 申论草稿 user+question 索引.
        "ix_essay_drafts_user_question",
    }
)
# 0004 把 practice_sessions.paper_id + paper_revision_id 从 NOT NULL 改 NULL,
# 当前 ORM 已 nullable. 0001 to_metadata 克隆时若直接用, 会建成 nullable —
# 然后 0004 ALTER (NOT NULL → NULL) 会被识别成无差异/报错. 这里 force 回
# NOT NULL 让 0001 → 0002 → ... → 0004 的 sequence 等价于 fresh schema.
#
# 0015 (identity v2) 把 users.username 从 NOT NULL 改 NULL — 同样 force.
# Downgrade 路径 (review fix #4): SET NOT NULL 前必须 backfill 含 NULL username
# 的行 (新 phone 注册用户) 才能不报 IntegrityError. migration 测试覆盖此路径.
_FORCE_NOT_NULL_IN_0001 = frozenset(
    {
        ("practice_sessions", "paper_id"),
        ("practice_sessions", "paper_revision_id"),
        ("users", "username"),  # 0015 (identity v2)
    }
)
# 0005 改 practice_session_answers.paper_position → display_order. 0001 用
# ORM 当前 attr 名 (display_order) 克隆会建出 display_order 列, 然后 0005
# ALTER RENAME 找不到 paper_position. 0001 baseline 必须建出老名字.
_RENAME_BACK_IN_0001 = frozenset(
    {
        ("practice_session_answers", "display_order", "paper_position"),
    }
)


def _baseline_metadata() -> MetaData:
    """Clone Base.metadata without 0002+ additions."""
    initial = MetaData()
    for table in Base.metadata.sorted_tables:
        if table.name in _TABLES_ADDED_IN_LATER:
            continue
        cloned = table.to_metadata(initial)
        # Strip per-table column additions (subject on questions, etc).
        for col in list(cloned.columns):
            if (cloned.name, col.name) in _COLUMNS_ADDED_IN_LATER:
                cloned._columns.remove(col)
        # Strip indexes added in 0002+ (the dropped column may still be
        # referenced by indexes copied via to_metadata).
        for idx in list(cloned.indexes):
            if idx.name in _INDEXES_ADDED_IN_LATER:
                cloned.indexes.discard(idx)
        # 0004 nullable flip — 0001 baseline 必须 NOT NULL, 让 0004 ALTER 起作用.
        for col in cloned.columns:
            if (cloned.name, col.name) in _FORCE_NOT_NULL_IN_0001:
                col.nullable = False
        # 0005 column rename — 0001 baseline 需用老名字 (paper_position), 让
        # 0005 ALTER RENAME 起作用. 通过 col.name 直接重命名 cloned column.
        for col in cloned.columns:
            for table_name, current_name, original_name in _RENAME_BACK_IN_0001:
                if cloned.name == table_name and col.name == current_name:
                    col.name = original_name
    return initial


def upgrade() -> None:
    bind = op.get_bind()
    _baseline_metadata().create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    _baseline_metadata().drop_all(bind=bind)
