---
type: engineering
status: draft
owner: xiaodeng
last-reviewed: 2026-05-20
source: multica
multica-issue: SIK-16
---

# SIK-16 Dashboard Review Record Auth Aggregate

## Goal

修复 `dashboard / progress / review / record` skeleton 的鉴权缺口、CSRF 缺口和 records 聚合语义错误，使其能作为前端可接的稳定空契约。

## Current Evidence

- `modules/planning/interface/routes.py` 和 `modules/progress/interface/routes.py` 当前没有 `get_current_user_v2` 依赖，匿名可直接访问。
- `modules/review/interface/routes.py` 的 GET/POST 全部无 auth，`redo` 也无 `verify_csrf_v2`。
- `modules/record/interface/routes.py` 已要求登录，但 `build_learning_record_summary()` 把 `essay_attempts` 算进 summary，`list_learning_records()` 却只返回 `PracticeSessionV2`，mixed 情况下 `summary` 与 `items/total` 不一致。
- `build_dashboard_records()` 的 section status 只看 practice items，无法反映 essay-only 用户。

## Define-First Boundary

- `/api/v2/dashboard/*`
  - Phase 1 统一要求登录访问
- `/api/v2/dashboard/progress/*`
  - Phase 1 统一要求登录访问
- `/api/v2/review/*`
  - GET 要求登录
  - `POST /items/{item_id}/redo` 要求登录 + CSRF
- `/api/v2/dashboard/records`
  - `summary.totalAttempts`、`items`、`total` 来自同一聚合语义
  - `xingce-only / essay-only / mixed` 三种场景都自洽

## Ownership

本 issue 独占以下文件的业务修改权：

- `services/api/src/sikao_api/modules/planning/interface/routes.py`
- `services/api/src/sikao_api/modules/progress/interface/routes.py`
- `services/api/src/sikao_api/modules/review/interface/routes.py`
- `services/api/src/sikao_api/modules/record/interface/routes.py`
- `services/api/src/sikao_api/modules/record/application/service.py`

测试优先新增独立文件：

- `services/api/tests/test_phase1_backend_dashboard_review_record_v2.py`

## Implementation Outline

1. 给 planning/progress/review 路由补 v2 登录依赖。
2. 给 review redo 补 v2 CSRF 依赖。
3. 重写 records 聚合，把 essay submission/report 纳入 items 语义或同步收口 summary。
4. 调整 section status，让 empty/partial 基于完整 records 语义。
5. 补匿名访问、CSRF、mixed 聚合回归测试。

## Tests

- dashboard/progress/review 匿名访问 401
- review redo 缺 CSRF 403
- xingce-only summary/items/total 一致
- essay-only summary/items/total 一致
- mixed summary/items/total 一致

## Overlap And Coordination

- `SIK-17` 可以补 infra 侧测试缺口，但不改本 issue 的业务聚合代码。
- `SIK-15` 不改 dashboard/review/record 文件。
- 若 records 需要引用 `EssaySubmissionV2` / `EssayReportV2` 以外的新字段，不扩散到 schema 层以避免和其他 issue 共改 `db/schemas_v2.py`。

## Acceptance Mapping

- 未登录访问相关接口返回 401
- review redo 需要 CSRF
- records 在 xingce-only / essay-only / mixed 三种情况下 summary 与 items 一致
- skeleton 空契约不再自相矛盾
