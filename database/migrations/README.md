# database/migrations

Status: `complete`（R3 完成 2026-05-13）

Alembic 迁移工作目录。

## 结构

```
database/migrations/
  alembic.ini       — Alembic 配置（script_location 用 %(here)s 解析为本目录）
  alembic/
    env.py          — 入口（import sikao_api.core.config 与 sikao_api.db.models.Base）
    versions/       — 23 个 migration version，head = 0023_essay_draft_sessions
```

## 运行

从 sikao 仓库根目录跑：

```bash
# 装依赖（含 alembic）
cd services/api && pip install -e ".[dev,postgres]"

# 配 DB URL（生产 PG / dev SQLite）
export DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5433/exam_api

# 从仓库根目录跑 alembic（用 -c 指定 config 路径）
cd D:/py_pj/sikao
alembic -c database/migrations/alembic.ini upgrade head

# 回滚一格
alembic -c database/migrations/alembic.ini downgrade -1

# 新建空 migration
alembic -c database/migrations/alembic.ini revision -m "add foo column"

# 当前 head
alembic -c database/migrations/alembic.ini current
```

## 关键

- env.py 已重写：`from sikao_api.core.config import get_settings` + `from sikao_api.db.models import Base`
- `alembic.ini` 用 `%(here)s` 让 script_location 跟随 ini 文件位置（避免 cwd 敏感）
- `prepend_sys_path` 指向 `../../services/api/src` 让 `sikao_api` 包可 import
- 跨方言 alembic_version VARCHAR(64) widening 已保留（应对长 revision id）

## R2 待办

- 数据迁移阶段：用户补完数据后，跑 `alembic upgrade head` 把 schema 拉到 0023
- ADR-0004（待写）：models.py 单文件拆分时机与方案
