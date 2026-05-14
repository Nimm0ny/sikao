# @sikao/admin

## Status

`not_started`

## Responsibility

后台管理端：题库录入、题目修订、note report 审核、用户管理。预留位。

## Legacy Source

- `new_web/apps/exam-api/app/api/routes/admin_v2.py`（已有后端 admin API）
- `new_web/apps/exam-api/app/api/routes/admin_note_reports_v2.py`
- new_web 暂无独立 admin 前端 view

## New Location

- `apps/admin/`

## Migrated

- 占位 README

## Missing

- 全部前端实现（new_web 也未独立做 admin 前端，brief 视为新增功能位）

## Notes

- 由于 new_web 没有 admin 前端，本目录仅占位。第一轮迁移不实现。
- 后端 admin API 见 `services/api/src/modules/admin`。
