"""SIKAO Wave 4 Phase 2B (notes module): 跨领域笔记本 + 间隔重复 (SM-2).

跟 0014_question_notes (题级 markdown) 是 **不同概念**:
  - 0014 question_notes : 一题一行 markdown (粒度 = question level).
  - 0018 notes          : 用户自由创建 N 张卡 (粒度 = user level, 跨题型沉淀
                          金句 / 方法论 / 反思 / 素材 4 类 NoteType).
两套并存, 不合并.

Two tables:
  notes         核心笔记表 (body_json discriminated union by type).
  note_reviews  复习历史 audit (一次 review 一行, SM-2 ease_after / interval).

SM-2 ease 字段:
  - notes.ease            当前 ease factor (默认 2.5, 下限 1.3).
  - notes.review_count    历史复习次数.
  - notes.next_review_at  下次复习时间 (queue 排序锚点).
  - notes.reviewed_at     最近一次复习时间.

跨领域字段:
  - notes.source_domain   'xingce' | 'essay' (跨领域决策, 单池 + filter).
  - notes.attached_to     JSONB optional, 含 wrongAnswerIds / questionTypeIds /
                          xingceQuestionIds / paperIds. P0/P1 用 JSONB containment
                          查询, 量大后 P3 抽 m2m 表.

Indexes:
  - (user_id, type)            grid + tab 筛选
  - (user_id, source_domain)   sourceDomain 筛选
  - (user_id, next_review_at)  today review queue ORDER BY next_review_at ASC
  - (user_id, created_at)      timeline view
  - note_reviews (note_id)     一笔记 N 次 review 关联查
  - note_reviews (user_id, reviewed_at)  streak / 复习历史

跨方言: JSON-like 列用 `sa.JSON()` (PG → JSONB 走 0012 风格 ALTER; SQLite → TEXT
fallback). 应用层永远 dict, 永不 json.dumps (memory `reference_jsonb_compat_pattern`).

0001 baseline drift: 本文件加 notes + note_reviews 必须同步更新 0001_initial.py
_TABLES_ADDED_IN_LATER 列表 — 否则清库重建 (fresh DB upgrade head) 撞
"table already exists" (memory `reference_alembic_0001_baseline_drift`).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0018_notebook_tables"
down_revision = "0017_pre_register_codes_add_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 'quote' | 'method' | 'reflect' | 'material' (业务 enum, Pydantic Literal 约束).
        sa.Column("type", sa.String(length=16), nullable=False),
        # discriminated union by type, shape:
        #   quote     -> { text: str }
        #   method    -> { title: str, steps: [{ index, text }] }
        #   reflect   -> { text: str }
        #   material  -> { rows: [{ key, value }] }
        sa.Column("body_json", sa.JSON(), nullable=False),
        # source kind: 'paper' | 'specialty' | 'manual' | 'practice' | 'grading'.
        sa.Column("source_kind", sa.String(length=16), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=False),
        sa.Column("source_quote", sa.Text(), nullable=True),
        # 'xingce' | 'essay' — 跨领域池筛选锚点.
        sa.Column("source_domain", sa.String(length=8), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        # NoteAttachedTo (optional): { wrongAnswerIds?, questionTypeIds?,
        # xingceQuestionIds?, paperIds? }. JSONB containment 查询走应用层.
        sa.Column("attached_to", sa.JSON(), nullable=True),
        # 'self' | 'group' (visibility=group P3 group 权限模型, 当前默认 self).
        sa.Column("visibility", sa.String(length=8), nullable=False, server_default="self"),
        # SM-2 ease factor, 默认 2.5, 下限 1.3 (业务层 clamp, schema 不约束).
        sa.Column("ease", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("next_review_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_notes_user_type", "notes", ["user_id", "type"])
    op.create_index(
        "ix_notes_user_source_domain", "notes", ["user_id", "source_domain"]
    )
    op.create_index(
        "ix_notes_user_next_review", "notes", ["user_id", "next_review_at"]
    )
    op.create_index("ix_notes_user_created", "notes", ["user_id", "created_at"])

    op.create_table(
        "note_reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewed_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        # SM-2 recall quality 0-5 (业务层 clamp validates).
        sa.Column("recall_quality", sa.Integer(), nullable=False),
        sa.Column("ease_before", sa.Float(), nullable=False),
        sa.Column("ease_after", sa.Float(), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("next_review_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_note_reviews_note", "note_reviews", ["note_id"])
    op.create_index(
        "ix_note_reviews_user_reviewed", "note_reviews", ["user_id", "reviewed_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_note_reviews_user_reviewed", table_name="note_reviews")
    op.drop_index("ix_note_reviews_note", table_name="note_reviews")
    op.drop_table("note_reviews")
    op.drop_index("ix_notes_user_created", table_name="notes")
    op.drop_index("ix_notes_user_next_review", table_name="notes")
    op.drop_index("ix_notes_user_source_domain", table_name="notes")
    op.drop_index("ix_notes_user_type", table_name="notes")
    op.drop_table("notes")
