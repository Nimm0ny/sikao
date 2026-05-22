---
type: plan
status: active
owner: Codex
created: 2026-05-23
updated: 2026-05-23
issue: Home-M11-M12
---

# Home M11-M12 Route-Shell Convergence + Records Acceptance

## Goal

Finish the remaining Home frontend tranche on `main` by landing:

1. `M11` route-shell convergence and `/profile/records`
2. `M12` automated acceptance, a11y coverage, and browser smoke evidence

without reopening unrelated Home backend/runtime scope.

## Locked Scope

1. Included
- Auth-aware root route: guest `"/"` stays marketing, authed `"/"` renders Home Dashboard.
- Canonical app routes:
  - `/`
  - `/practice`
  - `/review`
  - `/notes`
  - `/profile`
  - `/profile/learning`
  - `/profile/records`
- Legacy redirects for `/app`, `/study/today`, `/dashboard`, `/practice/center*`, `/wrong-book*`, `/plan`, `/progress`, `/me`.
- Backend records contract bump: `LearningRecordItemV2.href` becomes required.
- `/profile/records` runtime page with grouping, filters, pagination, and backend-driven row links.
- `M12` vitest redirect coverage, `ProfileRecords` integration tests, and `vitest-axe` a11y coverage.

2. Explicitly excluded
- No new Home API families beyond `LearningRecordItemV2.href`.
- No bootstrap-based onboarding gate rewrite.
- No repo-root Playwright/Cypress infrastructure migration.
- No shell architecture rollback to the old device-shell stack.
- No unrelated Home planner/progress/recommendation behavior changes.

## Contract Decisions

1. Records contract
- `LearningRecordItemV2` adds required `href: string`.
- Xingce records:
  - `pending` records resolve to `/practice/sessions/:sessionId`
  - `completed` records resolve to `/practice/result/:sessionId`
- Essay records:
  - completed report resolves to `/essay/grades/:reportId`
  - otherwise resolves to `/essay/history`
- Frontend consumes `href` directly and must not infer routes from record IDs.

2. Route-shell convergence
- `Dashboard.tsx` remains the Home runtime host but moves to authenticated `"/"`.
- `"/dashboard"` becomes a compatibility redirect to `/profile/learning`.
- Practice route family is flattened from `/practice/center*` to `/practice*` without changing the mounted views.
- Review route family is renamed from `/wrong-book*` to `/review*` with compatibility redirects kept in place.
- `MvpShell` is the single live shell to update; legacy shell components stay only as synchronized compatibility surfaces.

3. First-plan flow
- `OnboardingGate` continues to gate only on onboarding completion.
- Users with no active plan still land on the existing Home empty state and create a plan from there.
- No new `canStartPractice` or bootstrap gate is introduced in this tranche.

## Implementation Notes

1. Backend first
- Update `LearningRecordItemV2`, record aggregation service, backend tests, checked-in OpenAPI, and generated API types before wiring `ProfileRecords.tsx`.

2. Frontend convergence
- Update router, `MvpShell`, `Profile.tsx`, `ProgressSection`, and any CTA or test that still targets `/app`, `/dashboard`, `/plan`, `/progress`, or `/me`.
- Keep route compatibility explicit in tests so future cleanup can remove redirects safely.

3. Acceptance layer
- Add `vitest-axe` and a dedicated a11y test slice for:
  - guest/authed root
  - 5-tab shell
  - `/profile/records`
  - key empty/error states
- Browser smoke covers guest `/`, authed `/`, `/profile/records`, and legacy redirects on desktop/mobile viewports.

## Validation

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build -w @sikao/web`
- Scoped backend pytest for records/OpenAPI contract changes
- Scoped web vitest for router/AppShell/Dashboard/Profile/ProfileRecords/a11y
- Independent subagent review after `M11`
- Independent subagent review plus final diff review after `M12`
