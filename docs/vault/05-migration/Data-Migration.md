---
type: migration
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Data Migration

## 状态

R3 已落地（2026-05-13）：

- ✅ Alembic 23 versions 已迁入 `database/migrations/`
- ✅ env.py 重写到 `sikao_api.{core,db}`
- ✅ 5 个批量导入脚本迁入 `scripts/import/`
- ✅ Schema SQL 对照迁入 `database/schema/exam_papers.schema.sql`
- ✅ `BACKEND_DATA_ROOT` 配置项加入 settings（默认 `D:/py_pj/backend_data`）
- ⏳ 用户跑灌库脚本入题库（实际题库内容）

## 数据冷存位置

`D:/py_pj/backend_data/`（sikao 仓库**外**，gitignored，体积 4.4 GB）

```
backend_data/
├── xingce/                          行测 fenbi mirror
│   ├── papers/                      764 套 <id_name>/{paper.json, assets/}
│   ├── labels.json
│   ├── papers_index.json
│   ├── paper_status.json
│   └── paper_events.jsonl
├── shenlun/                         申论 standard json
│   ├── standard_json/               745 套 FBSL-*.standard.json
│   ├── classification.csv
│   ├── classification.json
│   └── region_paper_rows.csv
└── _backup/
    └── xingce.tar                   全量打包 2.2 GB
```

## 数据流

```
host VPS                          backend_data 冷存                 staging                   PG DB
─────────                         ─────────────                     ───────                   ─────
fenbi_scraper/fenbi_output/   ──sync_fenbi_mirror.py──▶  xingce/papers/<id_name>/
                                                          paper.json + assets/
                                                                  │
                                                                  │ fenbi_to_standard.py
                                                                  ▼
                                                          import-staging/<paperCode>/
                                                           paper.standard.json + assets/
                                                                  │
                                                                  │ import_fenbi_batch.py
                                                                  ▼
                                                                                       paper / revision /
                                                                                       section / block /
                                                                                       question / asset
```

申论无 staging（已是 standard json）：

```
backend_data/shenlun/standard_json/   ──services.import_standard_json_files──▶   PG DB
```

## 三层 dedupe

| 层 | 机制 | 触发 |
|---|------|------|
| Mirror | rsync size+mtime | host 多次抓同 paper 不重新下 |
| Adapter | dict 保序 + ensure_ascii=False → deterministic bytes → same `source_hash` | adapter 重跑同 paper 同 hash |
| DB | `source_hash` 命中现有 revision → 跳过 | adapter 输出同 hash 已 import → 跳过 |

## 灌库步骤（用户操作）

```bash
# 1. 配 backend_data 路径与 DB
export BACKEND_DATA_ROOT=D:/py_pj/backend_data
export DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api

# 2. 拉 alembic schema
cd D:/py_pj/sikao
alembic -c database/migrations/alembic.ini upgrade head

# 3. 批量导入行测（764 套，每套独立事务，预计 1-2 分钟）
python -m scripts.import.import_fenbi_batch

# 4. 批量导入申论（745 套，需要单独脚本或 admin API；待 R3 完善）
# TODO: 写 scripts/import/import_shenlun_batch.py（消费 standard_json 直接调
# services.import_standard_json_files），现在可手动从 admin 端调用
```

## 字段映射

### questions（new_web 旧 SQLite → 新 ORM）

| Legacy Field | New Field | Required | Notes |
|--------------|-----------|----------|-------|
| `id` | `id` | yes | 保留（fenbi 原 id） |
| `title` / `stem` | `stem` | yes | 题干 |
| `options` | 拆分到 `question_options` 表 | no | 多选用 JSON array |
| `answer` | `correct_answer` | yes | 多选用逗号分隔串（"A,C"） |
| `analysis` | `explanation` | no | 解析 |
| `material_id` | `material_group_id` | no | 大材料关联 |
| `subject_type` | `canonical_top_type` | yes | 由 backfill_question_subject 推断 |

完整字段表见 `services/api/src/sikao_api/db/models.py` 内 `Question` 类定义。

### papers

| Legacy Field | New Field | Notes |
|---|---|---|
| `id` | `id` | 保留 |
| `code` | `code` | fenbi paper code |
| `title` | `title` |  |
| `year` | `year` |  |
| `region` | `region` | 省份 |
| `paper_type` | `paper_type` | xingce/shenlun |

### assets

资产存储用 **absolute path**（new_web 旧实现）。生产部署时 `backend_data/` 路径必须与导入时一致，或加 path migration 脚本。这是 known issue，R2/R3 ADR 决策。

## 不兼容字段 / 丢弃字段

- new_web 历史 `local.db` 中的 in-process 测试数据 —— 不迁
- `paper_events.jsonl` —— 历史事件流，新版用 DB `ReleaseAudit` 表
- 部分 fenbi 元数据字段（如 `fenbi_label_id`）—— 保留在 `Question.metadata` JSON 列

## 关联

- [[Migration-Plan]] / [[Migration-Status]] / [[Database]]
- `scripts/import/README.md`（操作手册）
