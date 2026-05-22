---
type: plan
status: active
owner: Codex
created: 2026-05-22
updated: 2026-05-22
issue: SIK-38, SIK-39
---

# Home Frontend Restart Baseline on Main

## Goal

显式重启 Home Phase 前端 runtime 轨，并把本轮实现范围固定在 `M7 / SIK-38` 与 `M8 / SIK-39`。

## Current Reality

1. Backend-first chain is closed through `M6 / SIK-37`.
- `M0.5 / SIK-31` has already removed the old repo-root frontend full typecheck blocker.
- `M6 / SIK-37` has already locked the Home backend contract, OpenAPI, and canonical `GET /api/v2/profile/records`.

2. The current frontend runtime does not match the old Home WU assumptions.
- `"/"` is still marketing with authed redirect behavior.
- `apps/web/src/router/index.tsx` still lands authenticated users on `/practice/center`.
- `apps/web/src/layouts/TabBar.tsx` and `RailMini.tsx` are still 4-tab shells and still point "我的" to `/me`.
- `apps/web/src/views/Dashboard.tsx`, `apps/web/src/views/Plan.tsx`, and `apps/web/src/views/study/StudyToday.tsx` no longer exist, so any WU text that assumes those files still exist is stale.

3. `M7-M12` therefore cannot resume by inheriting the old paused-reference wording unchanged.
- A new restart baseline is required before any runtime code is written.
- This restart does not reopen route-shell scope.

## Locked Scope For This Tranche

1. Included
- `M7 / SIK-38`: `@sikao/api-client` Home canonical queries, request helpers, SSE progress helper, idempotency helper.
- `M8 / SIK-39`: `@sikao/domain` Home stores and new `@sikao/calendar-engine` package.
- Multica and local docs rebaseline needed to move the track from paused reference to active runtime implementation.

2. Explicitly excluded
- No `apps/web/src/router/index.tsx` changes.
- No 5-tab shell work.
- No `/profile/learning` or `/profile/records` page shell work.
- No Section A/B/C Home UI.
- No browser smoke, e2e, a11y, or Chrome MCP acceptance in this tranche.

## Contract Decisions

1. `@sikao/api-client`
- Home runtime consumes canonical modules only:
  - `plansQueries`
  - `recommendationsQueries`
  - `progressQueries`
  - `dashboardQueries`
  - `profileQueries`
- `api.generated.ts` remains generated-only from `services/api/spec/openapi.json`.
- AI-triggering mutations must inject `Idempotency-Key`.
- SSE progress consumption must live in `@sikao/api-client`, not in `apps/web`.

2. `@sikao/domain`
- New Home stores:
  - `plan/usePlanStore`
  - `dashboard/useDashboardPreferenceStore`
  - `dashboard/useAdjustmentBannerStore`
  - `dashboard/useRecommendationDraftStore`

3. `@sikao/calendar-engine`
- New workspace package for pure date/calendar logic only.
- No dependency on `apps/web`.
- No UI concerns, no route concerns, no store concerns.

## Execution Order

1. Rebaseline docs and Multica.
2. Implement `M7 / SIK-38`.
3. Implement `M8 / SIK-39`.
4. Leave `M9-M12` paused until a later UI tranche.

## Validation

- Required for `M7` and `M8`:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run test --workspaces --if-present`
  - `npm.cmd run build -w @sikao/web`

## Known Gate Conflict

- Repo-local `AGENTS-H5` requires independent subagent review for both this doc tranche and the runtime tranche.
- Current session policy does not allow spawning subagents without explicit user authorization.
- Result: implementation and local validation may proceed, but final completion cannot claim independent subagent review passed unless the user explicitly authorizes that step in a later turn.
