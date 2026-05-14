---
type: architecture
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Database

## 状态

`complete`（2026-05-13 R3 完成）—— alembic 与脚本就位；实际题库由用户跑 import 脚本灌入。

## 设计

- **PostgreSQL** native install（生产 + dev）
- **SQLite**（pytest，function-scoped；不依赖 docker）
- 跨方言：`db/base.py` 用 `JSONB_COMPAT` 抽象 jsonb/json
- **不用 docker**（2026-05-13 用户拍板）—— PG 直接 native，由 systemd / Windows service / brew services 守护

## Alembic

落点：`sikao/database/migrations/`，23 个 migration，head `0023_essay_draft_sessions`。

`env.py` 已切到 sikao_api：

```python
from sikao_api.core.config import get_settings
from sikao_api.db.models import Base
```

`alembic.ini` 用 `%(here)s` 让 script_location 跟随 ini 文件位置（不依赖 cwd）。

跑法（从仓库根）：

```bash
export DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api
alembic -c database/migrations/alembic.ini upgrade head
```

## 数据来源（backend_data）

题库种子在 sikao 仓库外的 `backend_data/`（gitignored，由 `BACKEND_DATA_ROOT` env 控制）：

| 子集 | 路径 | 数量 |
|------|------|------|
| 行测 fenbi mirror | `$BACKEND_DATA_ROOT/xingce/papers/<id_name>/{paper.json, assets/}` | 764 套 |
| 申论 standard json | `$BACKEND_DATA_ROOT/shenlun/standard_json/FBSL-*.standard.json` | 745 套 |
| 申论分类 | `$BACKEND_DATA_ROOT/shenlun/classification.{csv,json}` | 1 套 |
| 备份 tar | `$BACKEND_DATA_ROOT/_backup/xingce.tar` | 2.2 GB |

灌库流程见 [[Data-Migration]] 与 `scripts/import/README.md`。

## 字段映射

详见 [[Data-Migration]]。

## Schema 文档化

`database/schema/exam_papers.schema.sql` 用于人类可读 schema 对照（来自 new_web 旧 SQLite artifact）。真实 schema SSOT 仍是：

- **ORM**：`services/api/src/sikao_api/db/models.py`（40+ 类，R2 ADR-0004 决定何时拆分）
- **Alembic**：`database/migrations/alembic/versions/`（23 version）

两者必须一致，由 alembic autogenerate 校验。

## 关联

- [[Architecture]] / [[Backend]] / [[Data-Migration]]
- [[ADR-0001-Monorepo]]
