"""PR13 P5: 申论草稿持久化表 (essay_draft_records).

跟 essay_grading_records 区分:
  - drafts (本表): 用户输入中的草稿 (键盘 / 手写 metadata), FE 2s debounced
    autosave 写入. 每 (user_id, question_id) 唯一行, 多次保存 in-place update.
    用 UniqueConstraint (user_id, question_id) 实现 upsert (INSERT-then-UPDATE
    fallback, dialect-agnostic).
  - grading_records (0010): 用户最终 submit 的答案 + LLM 评分, 多次重做同题各占
    一行 (insert-only).

URL deviation from plan §8 (master 拍板, 跟 commit message 一致):
  Plan §8 写 endpoint /api/v2/essay/sessions/{session_id}/draft 但 BE 现状没
  session 实体, upsert 按 (user_id, question_id). 简化 URL 到 /drafts. session_id
  是 FE 路由 namespace, 不需 BE 实体对应. 跟 plan §3 schema (UniqueConstraint
  user_id+question_id) 字符级对齐.

handwritten_draft_metadata 走 sa.JSON().with_variant(JSONB(), "postgresql") —
PG=JSONB / SQLite=JSON, 跟 0001 baseline (Base.metadata.to_metadata 克隆 ORM
状态) 落地结果对齐, 避免 fresh-build vs migrated-build PG 列类型不一致
(0010 + 0012 老路径是 sa.JSON 后 ALTER JSONB, 本表新增直接 JSONB on PG).
业务层永远拿 dict (memory `reference_jsonb_compat_pattern`).

CASCADE: user / question 删 → draft 删 (跟 EssayGradingRecord 一致 PII 不留孤).
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# 跨方言 JSON 列 (memory `reference_jsonb_compat_pattern`): PG=JSONB / SQLite=JSON.
# 跟 app/domain/models.py JSONB_COMPAT 同构. 业务层永远拿 dict, 不 json.dumps.
_JSONB_COMPAT = sa.JSON().with_variant(JSONB(), "postgresql")

revision = "0023_essay_draft_sessions"
down_revision = "0022_note_social_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "essay_draft_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            sa.ForeignKey("questions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # max 5000 char 应用层 Pydantic Field(max_length=5000) 校验, DB Text 不约束.
        sa.Column(
            "typed_draft",
            sa.Text(),
            nullable=False,
            server_default=sa.text("''"),
        ),
        # 手写草稿 metadata: {path?, mime_type?, asset_id?, uploaded_at?,
        # stroke_count?}. PG=JSONB / SQLite=JSON, 业务层永远 dict.
        sa.Column("handwritten_draft_metadata", _JSONB_COMPAT, nullable=True),
        sa.Column(
            "saved_at",
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
        sa.UniqueConstraint(
            "user_id", "question_id", name="uq_essay_draft_user_question"
        ),
    )
    # 显式 BTREE index 给 EXPLAIN 分析方便 (unique constraint 也建索引, 但名字
    # 由 DB 派生不稳定, 这里命名 fixture 化).
    op.create_index(
        "ix_essay_drafts_user_question",
        "essay_draft_records",
        ["user_id", "question_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_essay_drafts_user_question",
        table_name="essay_draft_records",
    )
    op.drop_table("essay_draft_records")
