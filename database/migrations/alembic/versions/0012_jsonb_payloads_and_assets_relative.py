"""v1 上线设计 — JSONB payloads + assets 路径相对化.

xingce 题库 import 前置 schema 升级, 把全部 *_json 列从 Text/JSON 切到
JSONB (PG-only). SQLite 测试路径走 SA `JSON().with_variant(JSONB, "postgresql")`
fallback 到 TEXT/JSON, 应用层永远拿 dict/list 不用 json.dumps.

涵盖列 (10 个):
  paper_revisions.source_snapshot_json     Text  → JSONB
  material_groups.payload_json             Text  → JSONB
  question_assets.metadata_json            Text  → JSONB
  material_group_assets.metadata_json      Text  → JSONB
  questions.type_payload_json              Text  → JSONB
  questions.special_payload_json           Text  → JSONB
  questions.source_payload_json            Text  → JSONB
  practice_sessions.retry_question_ids_json Text → JSONB (nullable)
  study_plan_tasks.payload_json            JSON  → JSONB
  essay_grading_records.feedback_json      JSON  → JSONB

Assets 路径相对化 (M1): DB 不动 schema (file_path 仍是 Text), 业务侧改写入逻辑
存 `<paperCode>/assets/<basename>` 相对路径 + settings.assets_root 拼绝对.
对应 service 改动见 services/exam_papers.py::_resolve_assets / _copy_asset_to_root.

清库重做策略: xingce import 前 DROP SCHEMA + alembic upgrade head 重建,
不写数据迁移 SQL (CLAUDE.md §5 不要兼容层 / 双写过渡). 历史 12k 题已 pg_dump
留底, 新 import 全量重灌.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0012_jsonb_payloads_and_assets_relative"
down_revision = "0011_study_plans"
branch_labels = None
depends_on = None


# 全部需要切到 JSONB 的列. (table, column, was_text, nullable)
# was_text=True: Text 列, USING jsonb 反序列化
# was_text=False: JSON 列, USING ::jsonb 直接 cast
_JSONB_COLUMNS = [
    ("paper_revisions", "source_snapshot_json", True, False),
    ("material_groups", "payload_json", True, False),
    ("question_assets", "metadata_json", True, False),
    ("material_group_assets", "metadata_json", True, False),
    ("questions", "type_payload_json", True, False),
    ("questions", "special_payload_json", True, False),
    ("questions", "source_payload_json", True, False),
    ("practice_sessions", "retry_question_ids_json", True, True),
    ("study_plan_tasks", "payload_json", False, False),
    ("essay_grading_records", "feedback_json", False, True),
]


def upgrade() -> None:
    # 升级路径双场景:
    # (A) Fresh build (本次清库重做): 0001 的 to_metadata 用当前 model 状态克隆
    #     JSONB_COMPAT, 在 PG dialect 已渲染成 JSONB → 0012 列已是 jsonb, ALTER
    #     是 no-op, 跳过避免 PG `invalid input syntax for type json` 误报.
    # (B) 老 dev / prod 升级: 0001-0011 老 schema *_json 列是 Text/JSON →
    #     0012 ALTER 真正切 JSONB, USING 表达式做 cast.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        existing_types = _existing_column_types(bind)
        for table, column, was_text, _nullable in _JSONB_COLUMNS:
            current_type = existing_types.get((table, column), "").lower()
            if current_type == "jsonb":
                continue  # Fresh build 路径 — 0001 已建 JSONB, no-op.
            # text → JSONB / json → JSONB 直接 cast. 0 row 表 cast 不真执行.
            using_expr = (
                f"{column}::text::jsonb"
                if was_text
                else f"{column}::jsonb"
            )
            op.alter_column(
                table,
                column,
                type_=JSONB(),
                postgresql_using=using_expr,
            )
        return

    # SQLite (测试路径): batch_alter_table 切 JSON 类型. SQLAlchemy JSON
    # 在 sqlite 落 TEXT (auto-dumps/loads), 行为对应用层透明. 应用层永远 dict/list.
    for table, column, _was_text, _nullable in _JSONB_COLUMNS:
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column(column, type_=sa.JSON())


def _existing_column_types(bind) -> dict[tuple[str, str], str]:
    """Read PG information_schema 一次性拿全部目标列当前类型."""
    rows = bind.execute(
        sa.text(
            "SELECT table_name, column_name, data_type "
            "FROM information_schema.columns WHERE table_schema = current_schema()"
        )
    ).fetchall()
    return {(r[0], r[1]): r[2] for r in rows}


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table, column, was_text, _nullable in _JSONB_COLUMNS:
            target_type = sa.Text() if was_text else sa.JSON()
            using_expr = (
                f"{column}::text"
                if was_text
                else f"{column}::json"
            )
            op.alter_column(
                table,
                column,
                type_=target_type,
                postgresql_using=using_expr,
            )
        return

    for table, column, was_text, _nullable in _JSONB_COLUMNS:
        target_type = sa.Text() if was_text else sa.JSON()
        with op.batch_alter_table(table) as batch_op:
            batch_op.alter_column(column, type_=target_type)
