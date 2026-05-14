"""SIKAO Wave 8 Phase A: user_exams 新表 + study_plans 扩 3 字段.

Home 4-block 模块需要的 schema 基础:

新表 user_exams (用户自定义考试日历):
  - 跟 exam_events (全局公告 admin 维护) 互补 — user_exams 是用户自己加的
    "我要考的 N 场" (考公 / 考研 / 单位 special 考核 / ...). exam_event_id
    FK 可空, 让用户从 exam_events 库选 (auto-fill name/date) 也允许纯手填.
  - study_plan_id FK SET NULL: 用户给某场考试绑定专属学习计划 (Phase B 写
    /sync 时设置), 删 study_plan 不删 user_exam.
  - 复合索引 (user_id, exam_date) 给 "我的近期考试" query 用 (Home block 1).

study_plans 扩 3 字段 (Home block 4 "今日配额" 数据源):
  - daily_quota             ∈ [0, ∞) NULL — 今日总题量目标 (整数). NULL 兼容
                            旧记录 (Phase B 写新 plan 时 LLM 输出 / 用户设).
  - daily_accuracy_target   ∈ [0, 1]  NULL — 今日正确率目标 (浮点). 同上 NULL
                            兼容旧.
  - subject_quotas          JSONB_COMPAT (dict[str, int]) NULL — 学科细分配额,
                            e.g. {"言语": 10, "判推": 5, "资分": 5}. 应用层
                            永远拿 dict 不 json.dumps (memory
                            `reference_jsonb_compat_pattern`).

兼容: 3 个新字段全 nullable=True, 老 study_plan 行 ALTER 后 NULL — Phase B
service GET /today 把 NULL 处理为 "未设配额" 渲对应空态 UI.

0001 baseline drift (memory `reference_alembic_0001_baseline_drift`):
  - user_exams         → 0001 _TABLES_ADDED_IN_LATER
  - 3 个 study_plans 列  → 0001 _COLUMNS_ADDED_IN_LATER

downgrade: drop column ×3 + drop index + drop table user_exams (标准模板).
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0021_user_exams_and_study_plan_quotas"
down_revision = "0020_extend_wrong_masteries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # user_exams 新表 — 用户自定义考试条目.
    op.create_table(
        "user_exams",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # 用户可关联 exam_events 库里的 row, 也可纯手填. SET NULL: 删 event 不删
        # user_exam (用户仍保留 "我要考" 的记录, exam_event_id 落空仅丢联动).
        sa.Column(
            "exam_event_id",
            sa.Integer(),
            sa.ForeignKey("exam_events.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        # 用户给这场考试绑专属计划. SET NULL: 删计划不删考试 (用户后续可重新
        # 关联). 关系本身在 Phase B service /sync endpoint 维护.
        sa.Column(
            "study_plan_id",
            sa.Integer(),
            sa.ForeignKey("study_plans.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
    # "我的近期考试" 主查询 ORDER BY exam_date — 复合索引覆盖.
    op.create_index(
        "ix_user_exams_user_date",
        "user_exams",
        ["user_id", "exam_date"],
    )

    # study_plans 扩 3 字段 — 全 nullable 兼容旧记录.
    with op.batch_alter_table("study_plans") as batch_op:
        batch_op.add_column(
            sa.Column("daily_quota", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("daily_accuracy_target", sa.Float(), nullable=True)
        )
        # JSONB_COMPAT — PG=JSONB, SQLite test=JSON. 应用层永远 dict.
        # alembic op 层不能直接引 JSONB_COMPAT (是 ORM 层 type variant), 用
        # sa.JSON() 表达 SQLite 落 TEXT, PG dialect compiler 给 JSON. 实测
        # add_column(JSON()) 在 PG 落到 JSON 列 — 跟 ORM type 兼容 (ORM 读
        # dict 不报错). 0017_pre_register_codes_add_user_id / 0019 等都是此模式.
        batch_op.add_column(
            sa.Column("subject_quotas", sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("study_plans") as batch_op:
        batch_op.drop_column("subject_quotas")
        batch_op.drop_column("daily_accuracy_target")
        batch_op.drop_column("daily_quota")
    op.drop_index("ix_user_exams_user_date", table_name="user_exams")
    op.drop_table("user_exams")
