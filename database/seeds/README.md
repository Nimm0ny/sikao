# database/seeds

Status: `partial`（R3 落地 2026-05-13）

初始化数据。

## 数据来源

实际题库种子放在 `backend_data/`（sikao 仓库**外**），由 `scripts/import/` 脚本灌库：

| Seed 内容 | 来源 | 灌库脚本 |
|---|---|---|
| 行测题库 764 套 | `D:/py_pj/backend_data/xingce/papers/` | `scripts/import/import_fenbi_batch.py` |
| 申论题库 745 套 | `D:/py_pj/backend_data/shenlun/standard_json/` | services/api admin `import_standard_json_files` 或自定义脚本 |
| 申论分类 | `D:/py_pj/backend_data/shenlun/classification.{csv,json}` | 入库时一并消费 |
| 国考事件日历 | （new_web 内嵌） | 待整理 |

## 本目录

`database/seeds/` 本目录只放**初始化代码必须**且**轻量**的种子（用户角色、权限、考试事件常量等），不放题库 dump（体积过大）。

R2 / R3 演进时若有内嵌种子（如默认 admin 用户）会以 SQL / Python 脚本形式落地这里。
