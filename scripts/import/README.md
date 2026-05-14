# scripts/import

Status: **active**（R3 完成 2026-05-13）

题库与数据导入脚本。从 `backend_data/` 冷存 → 转标准 JSON → 入 sikao DB。

## 数据流（per new_web AGENTS.md §12 三层 mirror → staging → DB）

```
host VPS                          backend_data 冷存                staging              DB
─────────                         ─────────────                    ───────              ──
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
                                                                  paper / revision / section /
                                                                  block / question / asset 行
```

申论一路直接以 standard json 形式落地（fenbi_shenlun_to_standard.py 一次性转完已落在 `backend_data/shenlun/standard_json/`）。

## 脚本

| 脚本 | 用途 | 默认数据源 |
|---|---|---|
| `sync_fenbi_mirror.py` | SSH 拉 fenbi VPS → 本地 mirror（增量） | host 远端 → `$BACKEND_DATA_ROOT/xingce/` |
| `fenbi_to_standard.py` | 单 paper 适配器（fenbi paper.json → standard json） | mirror → staging |
| `fenbi_shenlun_to_standard.py` | 申论专用适配器（一次性） | — |
| `aipta_text_to_standard.py` | AIPTA 文本格式适配器 | — |
| `import_fenbi_batch.py` ⭐ | 批量入库主入口（扫 mirror、转 staging、落 DB、三层 dedupe） | `$BACKEND_DATA_ROOT/xingce/` → `$BACKEND_DATA_ROOT/import-staging/` → `$DATABASE_URL` |

## 调用

```bash
# 环境变量配 backend_data 位置（默认 D:/py_pj/backend_data）
export BACKEND_DATA_ROOT=D:/py_pj/backend_data

# 单 paper 转换
python -m scripts.import.fenbi_to_standard \
  --input $BACKEND_DATA_ROOT/xingce/papers/100197_2020年云南公务员录用考试 \
  --output $BACKEND_DATA_ROOT/import-staging/100197

# 批量入库（764 套行测）
python -m scripts.import.import_fenbi_batch

# 申论批量入库（standard json 直接走 ExamPaperService.import_standard_json_files）
# 745 套 FBSL-*.standard.json 在 backend_data/shenlun/standard_json/，
# 直接通过 services/api admin import 接口或自定义脚本批量调用 services.import_standard_json_files
```

## 配置

`BACKEND_DATA_ROOT` 环境变量（也在 `services/api/src/sikao_api/core/config.py::Settings.backend_data_root`）控制冷存根目录。默认 `D:/py_pj/backend_data`（lhr 本机）。

数据布局（per `backend_data/README.md`）：

```
backend_data/
├── xingce/                              行测 fenbi mirror
│   ├── papers/                          764 套 <id_name>/{paper.json, assets/}
│   ├── labels.json
│   ├── papers_index.json
│   ├── paper_status.json
│   └── paper_events.jsonl
├── shenlun/                             申论 standard json 落地
│   ├── standard_json/                   745 套 FBSL-*.standard.json
│   ├── classification.csv
│   ├── classification.json
│   └── region_paper_rows.csv
└── _backup/
    └── xingce.tar                       全量打包 2.2 GB
```

## 注意

- `backend_data/` 在 sikao 仓库**之外**（D:/py_pj/backend_data），不在 git 内。
- 资产路径在 DB 中以 absolute path 存储（new_web 旧实现），生产部署时 backend_data 路径要保持稳定或加资产路径迁移脚本。这是 known issue，待 ADR 决策。
- 三层 dedupe（mirror size / adapter deterministic / DB source_hash）保证脚本可重跑、无副作用。
