"""SIKAO Wave 10 Phase A: notes 加 6 列 + 4 新表 (笔记本社交化).

笔记本社交化 schema 基础 — Phase B (service / endpoint) + Wave 10 FE wire 复用.

notes 扩 6 列:
  - is_public          ∈ {true,false} NOT NULL default false — 用户主动 "发表"
                       笔记到题目下方公开笔记区 (FE 单题视图聚合 query) 才置 true.
                       跟现有 `visibility` 字段 (P3 group 权限模型, 默认 'self')
                       独立: `visibility` 控笔记本组内分享, `is_public` 控题目
                       下方公开池. 两套并存不合并 (语义不同).
  - public_at          NULLABLE timestamp — 首次置 is_public=true 的时间 (FE
                       "公开 N 天前" 显示锚点). 取消公开 (回 false) 不清此字段
                       (历史 audit), 重新公开覆盖.
  - display_anonymous  ∈ {true,false} NOT NULL default true — lhr 决议: 默认
                       匿名展示 (隐私优先). FE 公开笔记列表里 display_anonymous=true
                       的笔记隐藏 user 信息, false 才显 user.display_name.
  - likes_count        INTEGER NOT NULL default 0 — note_likes 表对应行数缓存
                       (Phase B service 增删 like 同步 +/-1). 避免每次 GET
                       笔记列表 COUNT() join.
  - comments_count     INTEGER NOT NULL default 0 — note_comments 对应缓存,
                       同 likes_count 维护模式.
  - question_id        NULLABLE FK questions(id) SET NULL — 笔记绑题字段, 让
                       "题目下方公开笔记 top voted" query 一行索引扫即可
                       (复合 index ix_notes_question_public_likes 覆盖).
                       SET NULL: 删 question 不删笔记, 笔记落孤. NULL 允许
                       笔记不绑题 (跨题型 method/quote 笔记仍可公开但不挂题).

复合 index ix_notes_question_public_likes:
  - (question_id, is_public, likes_count) BTREE — FE 单题视图 "下方公开
    笔记 ORDER BY likes_count DESC LIMIT N" 查询主索引. PG 走 BTREE 即可
    (likes_count 跨度小, 不需要 BRIN). SQLite 测试也走 BTREE (默认).

note_comments (一级嵌套, lhr 决议):
  - parent_comment_id NULLABLE FK note_comments(id) CASCADE — 回复某 comment
    带 parent_id, 顶层 comment parent NULL. 不允许 grand-child (2+ 级嵌套),
    应用层校验 (Phase B): create 时若 parent.parent_id IS NOT NULL 拒绝.
  - content TEXT NOT NULL — 应用层校 ≤500 char (Phase B Pydantic).
  - likes_count 缓存同 notes (后续 note_comment_likes 表? Wave 10 暂不做,
    Phase B 只支持 note 级 like, comment 级 like 推 follow-up).

note_likes / note_favorites (unique composite):
  - (note_id, user_id) UNIQUE — 一个用户对一条笔记最多一个 like / favorite.
    Phase B service 走 INSERT ... ON CONFLICT DO NOTHING (PG) / INSERT OR
    IGNORE (SQLite) 实现 toggle. likes_count 同 transaction 维护.
  - CASCADE: 删 note / 删 user 带走 like/fav 行 (不留孤 PII).

note_reports (admin queue):
  - target_type   String(20) 'note' | 'comment' — polymorphic FK 模式 (target_id
                  在 note 时引 notes.id, comment 时引 note_comments.id). SA
                  不能强约束 polymorphic FK, 应用层校验 (Phase B).
  - status        'pending' | 'reviewed' | 'dismissed', default 'pending' index.
                  admin /admin/reports queue 走 WHERE status='pending' ORDER BY
                  created_at ASC. reviewed_by_admin_id SET NULL 删 admin 不删
                  report.
  - reason        TEXT — 用户自由输入 (≤500 char 应用层).

0001 baseline drift (memory `reference_alembic_0001_baseline_drift`):
  - 4 新表 → 0001 _TABLES_ADDED_IN_LATER
  - 6 新列 → 0001 _COLUMNS_ADDED_IN_LATER
  - 1 新 index → 0001 _INDEXES_ADDED_IN_LATER

JSONB_COMPAT (memory `reference_jsonb_compat_pattern`):
  - 本 migration 无 JSON-like 列, 不涉及 JSONB_COMPAT. (note_reports.reason
    是 plain text, 不存结构化数据.)

downgrade 顺序: drop tables (依赖低的先) → drop index → drop columns. notes
question_id 列在 drop index 后再 drop (index 引用此列).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0022_note_social_features"
down_revision = "0021_user_exams_and_study_plan_quotas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # notes 扩 6 列. server_default 给跨方言 boolean true/false 安全文本.
    # 用 batch_alter_table — SQLite 不支持 ALTER 加 FK constraint (question_id
    # → questions.id), batch mode 走 copy-and-move 重建表方式. PG 不需要 batch
    # 但 batch mode 在 PG 下也合法 (op.batch_alter_table 自动检测 dialect 选路径).
    # FK 显式 name="fk_notes_question_id" 是 batch mode 要求.
    with op.batch_alter_table("notes") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_public",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            )
        )
        batch_op.add_column(
            sa.Column("public_at", sa.DateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "display_anonymous",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "likes_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "comments_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "question_id",
                sa.Integer(),
                sa.ForeignKey(
                    "questions.id",
                    ondelete="SET NULL",
                    name="fk_notes_question_id",
                ),
                nullable=True,
            )
        )

    # 单列 index for question_id JOIN 路径 (单题 → 笔记) — 跟复合 index 各有用途.
    op.create_index("ix_notes_question_id", "notes", ["question_id"])

    # 复合 index: 单题视图 "公开笔记 top voted" 主 query 主索引.
    op.create_index(
        "ix_notes_question_public_likes",
        "notes",
        ["question_id", "is_public", "likes_count"],
    )

    # note_comments — 一级嵌套, parent_comment_id NULLABLE.
    op.create_table(
        "note_comments",
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
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "parent_comment_id",
            sa.Integer(),
            sa.ForeignKey("note_comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "likes_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
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
    op.create_index("ix_note_comments_note", "note_comments", ["note_id"])
    op.create_index("ix_note_comments_user", "note_comments", ["user_id"])
    op.create_index(
        "ix_note_comments_parent", "note_comments", ["parent_comment_id"]
    )

    # note_likes — unique composite (note_id, user_id).
    op.create_table(
        "note_likes",
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
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "note_id", "user_id", name="uq_note_likes_note_user"
        ),
    )

    # note_favorites — 同 likes 模式.
    op.create_table(
        "note_favorites",
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
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "note_id", "user_id", name="uq_note_favorites_note_user"
        ),
    )

    # note_reports — 举报 queue (admin /admin/reports).
    op.create_table(
        "note_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column(
            "reporter_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "reviewed_by_admin_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_note_reports_target", "note_reports", ["target_id"])
    op.create_index("ix_note_reports_status", "note_reports", ["status"])


def downgrade() -> None:
    # 4 新表 — 反向 drop. note_reports 不被引用先删, 其他独立.
    op.drop_index("ix_note_reports_status", table_name="note_reports")
    op.drop_index("ix_note_reports_target", table_name="note_reports")
    op.drop_table("note_reports")
    op.drop_table("note_favorites")
    op.drop_table("note_likes")
    op.drop_index("ix_note_comments_parent", table_name="note_comments")
    op.drop_index("ix_note_comments_user", table_name="note_comments")
    op.drop_index("ix_note_comments_note", table_name="note_comments")
    op.drop_table("note_comments")

    # notes 6 列 — 先 drop index 再 drop column. 用 batch_alter_table 跟
    # upgrade 对称, SQLite ALTER DROP COLUMN 跟 add 一样需要 batch mode 重建.
    op.drop_index("ix_notes_question_public_likes", table_name="notes")
    op.drop_index("ix_notes_question_id", table_name="notes")
    with op.batch_alter_table("notes") as batch_op:
        batch_op.drop_column("question_id")
        batch_op.drop_column("comments_count")
        batch_op.drop_column("likes_count")
        batch_op.drop_column("display_anonymous")
        batch_op.drop_column("public_at")
        batch_op.drop_column("is_public")
