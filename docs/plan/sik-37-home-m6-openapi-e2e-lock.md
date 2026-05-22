---
type: engineering
status: active
owner: codex
last-reviewed: 2026-05-22
source: multica
multica-issue: SIK-37
---

# SIK-37 Home M6 OpenAPI E2E Lock

## Goal

完成 Home Phase M6 的 backend-first 收口：把 plans / events / recommendations / progress / planning / profile records 的主链路测试补齐，把 OpenAPI 与生成类型重新锁定，并删除 `GET /api/v2/dashboard/records` legacy shim。

## Current Evidence

- `SIK-37` 当前处于 `in_progress`，issue 明确拆为 `B9-prep` 与 `B9-lock` 两段。
- `SIK-36 / M5` 已完成并落地主干；Home scheduler、cron、login/submit/skipped hooks 已具备最终断言前提。
- `SIK-37` issue 引用的 `docs/plan/home-b8-b9-execution-baseline-2026-05-22.md` 与 `docs/plan/home-backend-first-unblock.md` 在本地仓库不存在，不能作为本地 define-first 基线。
- 当前 checked-in `services/api/spec/openapi.json` 与 `create_app().openapi()` 已出现大幅 drift，说明 M2-M5 的契约未在 spec 上完成锁定。
- 当前根脚本 `scripts/generate-api-types.sh` 直接写 `create_app().openapi()`，而 `services/api/src/sikao_api/cli/export_openapi.py` 使用 deterministic JSON 导出；两条路径语义不一致。
- 当前 `packages/api-client/src/types/api.generated.ts` 仍包含 `/api/v2/dashboard/records` 与 `/api/v2/profile/records` 两套路由。
- 当前 `services/api/src/sikao_api/modules/record/interface/routes.py` 仍公开 `/api/v2/dashboard/records` shim；canonical records API 已在 `modules/profile_v2/interface/routes.py` 的 `/api/v2/profile/records`。

## Define-First Boundary

- M6 只做 backend-first 收口，不启动 Home legacy frontend runtime，不碰 `apps/web` 运行时代码。
- M6 分两段执行：
  - `B9-prep`: non-cron e2e、OpenAPI drift harness、records shim assertion matrix、导出链收口准备。
  - `B9-lock`: cron/login/submit-refresh final assertions、shim 删除、checked-in `openapi.json` 与 `api.generated.ts` 锁定。
- `B9-prep` 阶段禁止提前删除 `/api/v2/dashboard/records` shim，避免把准备工作和契约破坏混在一起。
- `B9-lock` 允许删除 shim，但必须同时更新：
  - OpenAPI checked-in spec
  - generated TS types
  - 所有 contract / e2e / route assertions
- OpenAPI 锁定以 `services/api/spec/openapi.json` 为 backend SSOT，types 锁定以 `packages/api-client/src/types/api.generated.ts` 为 frontend consumer snapshot。
- `scripts/generate-api-types.sh` 必须复用 deterministic export 路径，不能继续绕过 `export_openapi.py` 另写一套 schema 输出。

## Test Inventory

| Key | Scope | Notes |
|---|---|---|
| `home.m6.e2e.plans_events` | plans + events non-cron full flow | create / list / update / recurring / restore / conflicts |
| `home.m6.e2e.recommendations` | refresh / accept / reject / history | 含 idempotency / linked session or plan event side effect |
| `home.m6.e2e.progress` | overview / timeseries / weakness / diagnosis | 证明 progress freshness 与 snapshot 路径一致 |
| `home.m6.e2e.planning_profile` | today / weekly / full-plan / profile records | 含 canonical `/profile/records` |
| `home.m6.final.scheduler_hooks` | cron/login/submit-refresh assertions | 建立在 M5 runtime 上的最终断言 |
| `home.m6.contract.openapi_drift` | checked-in spec vs live app | drift != 0 直接 fail-fast |
| `home.m6.contract.records_shim_matrix` | shim present in prep, absent in lock | 显式覆盖删除时机 |

## Shim Semantics

- canonical records API: `GET /api/v2/profile/records`
- legacy shim: `GET /api/v2/dashboard/records`
- `B9-prep`:
  - shim 继续存在
  - 必须验证 shim 只是 records summary/list 的兼容入口
  - 必须验证 canonical route 已满足分页、过滤、`session_id` deep-link 语义
- `B9-lock`:
  - 删除 shim route
  - 删除 spec/types/test 中对 `/api/v2/dashboard/records` 的长期契约声明
  - 保留对 canonical route 的完整 contract coverage

## OpenAPI And Typegen Rules

- spec 导出命令以 `services/api/scripts/export_openapi.py` 为唯一 backend 导出入口。
- 根脚本 `scripts/generate-api-types.sh` 只能复用该导出入口，不允许再直接在 shell heredoc 中构造 schema。
- drift harness 必须比较：
  - live `create_app().openapi()`
  - checked-in `services/api/spec/openapi.json`
- types regen 必须以 checked-in spec 为输入，避免生成链路与 checked-in artifact 脱钩。

## Tranche Breakdown

1. `B9.0` 本地 define-first baseline + drift inventory
2. `B9-prep.1` plans + events non-cron e2e
3. `B9-prep.2` recommendations non-cron e2e
4. `B9-prep.3` progress non-cron e2e
5. `B9-prep.4` planning + profile records e2e + shim assertion matrix
6. `B9-prep.5` OpenAPI export/drift harness prep
7. `B9-lock.1` cron/login/submit-refresh final assertions
8. `B9-lock.2` remove records shim + regenerate spec/types + update contract assertions

## Validation

- scoped `ruff`
- scoped `mypy`
- targeted `pytest`
- OpenAPI regen + TS type regen
- 独立 review agent 审查

## Known Drift Notes

- `SIK-37` issue 中引用的两份旧 `docs/plan/*` 文件本地不存在；本文作为当前本地 define-first 基线替代。
- 当前 checked-in `services/api/spec/openapi.json` 与 live app 已明显漂移；在 `B9-lock` 前不能宣称契约已锁定。
- 当前 `scripts/generate-api-types.sh` 与 `services/api/src/sikao_api/cli/export_openapi.py` 导出策略不一致；M6 必须统一。
- repo-root full validation 仍受已知前端迁移 blocker 影响；本 issue 只能宣告 backend-first scoped validation 结果，不能误报全量验证通过。
