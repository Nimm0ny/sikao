# database/schema

Status: `partial`（R3 完成 2026-05-13）

数据模型 DDL 与 schema 文档。

## 文件

- `exam_papers.schema.sql` — 来自 `new_web/data/artifacts/exam_papers.schema.sql`，行测题库参考 schema。仅作**对照**用，**不是** sikao 的 SSOT；真实 schema 由 `services/api/src/sikao_api/db/models.py` ORM 定义、alembic 维护演进。

## 关联

- Alembic SSOT：`database/migrations/alembic/versions/`（23 个 version）
- ORM SSOT：`services/api/src/sikao_api/db/models.py`（40+ ORM 类，单文件，R2 ADR-0004 决定何时拆分）
- 字段映射文档：[[Data-Migration]]
