# database

## Status

`partial` — 目录结构就位，数据相关内容（migrations 版本、seeds、schema）按用户指示**本轮不迁**。

## 子目录

- `migrations/` — Alembic 迁移工作目录（env.py + alembic.ini + versions/）
- `seeds/`     — 初始化数据（题库、用户角色等种子）
- `schema/`    — 数据模型 DDL / ER 图 / 文档化 schema

## Legacy Source

- `new_web/apps/exam-api/alembic/`（23 个 migration，最新 head `0023_essay_draft_sessions`）
- `new_web/data/import/`（fenbi 题库导入数据）
- `new_web/data/artifacts/exam_papers.{db,schema.sql}`

## New Location

- `database/migrations/`
- `database/seeds/`
- `database/schema/`

## Notes

- 用户 2026-05-13 明示：**数据有缺漏，本轮不迁，由用户补全后再迁**。
- 因此 `database/migrations/versions/` 与 `database/seeds/*` 暂时为空。
- Alembic env.py 由 services/api 引用（数据走 backend 的 SQLAlchemy session）；下一轮启用时把 new_web/apps/exam-api/alembic 整迁过来。
- 详见 [docs/vault/05-migration/Data-Migration.md](../docs/vault/05-migration/Data-Migration.md)。
