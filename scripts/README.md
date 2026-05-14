# scripts

跨子项目的脚本集合。

## 子目录

- `migration/` — new_web → sikao 一次性迁移辅助脚本（如批量重命名、import 改写）
- `import/`    — 题库 / 数据导入脚本（fenbi adapter、aipta 转换、backfill）

## Legacy Source

- `new_web/apps/exam-api/app/scripts/`（fenbi_to_standard, import_fenbi_batch, sync_fenbi_mirror, aipta_text_to_standard, backfill_*）
- `new_web/scripts/`（如有）

## Notes

- 数据导入脚本的迁移依赖 services/api 的模块化完成；本轮**不**搬。
- 完成搬运后，原 `services/api/src/sikao_api/scripts/` 中应仅保留**真正在生产中由 API 内部调用**的脚本，**面向人/CI 的批处理脚本**应统一放到 `scripts/import/`。
