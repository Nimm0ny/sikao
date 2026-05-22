---
type: plan
status: active
owner: Codex
created: 2026-05-22
updated: 2026-05-22
issue: SIK-41
---

# Home M10 Sections B/C + ProfileLearning Runtime

## Goal

Restart `SIK-41 / M10` as an active runtime tranche and complete the rest of the Home dashboard information architecture on `main` without pulling `M11-M12` forward.

## Current Reality

1. `M9 / SIK-40` is already running on `main`.
- `"/dashboard"` is a real authenticated Section A host.
- `"/plan"` already aliases into the same Section A runtime.
- Review, validation, and authenticated Chrome smoke evidence already exist for that tranche.

2. The remaining Home dashboard surface is still missing.
- `Dashboard.tsx` still mounts only `PlanSection`.
- `/profile/learning` is not registered yet.
- Section B/C UI and their browser-visible flows are still absent.

3. `M11` route-shell convergence is still out of scope.
- No `"/"` dual-state convergence in this tranche.
- No 5-tab cleanup, `/me` fix, `/profile/records`, or legacy redirect cleanup in this tranche.

## Locked Scope For This Tranche

1. Included
- Upgrade `Dashboard.tsx` into the authenticated Home aggregator page.
- Land Section B (`ProgressSection`) and Section C (`RecommendationSection`) on the dashboard host.
- Add `/profile/learning` and complete its full runtime, including radar and full trend charts.
- Add `recharts` for the M10 chart surfaces.

2. Explicitly excluded
- No `/profile/records`.
- No root-route convergence.
- No 5-tab or `/me` cleanup.
- No onboarding gate changes.
- No legacy route family rename or cleanup.

## Contract Decisions

1. Data sources
- Section A continues to consume existing `PlanSection` runtime.
- Section B consumes only canonical Home progress queries:
  - `useProgressOverview`
  - `useProgressTimeseries`
  - `useProgressWeakness`
  - `useProgressDiagnosis`
- Section C consumes only canonical Home recommendation queries and mutations:
  - `useRecommendationsToday`
  - `useRefreshRecommendations`
  - `useAcceptRecommendation`
  - `useRejectRecommendation`
  - `useRecommendationDraftStore`

2. Chart surfaces
- `WeaknessRadar` uses `recharts` and is fed directly from `subjectAccuracies`.
- `TimeseriesChart` uses `recharts` and supports:
  - `day/week` granularity
  - `minutesPracticed`
  - `itemsAnswered`
  - `accuracy`
  - `sessionsCount`
- Unknown metrics or unsupported recommendation action mappings fail fast into section-local error states.

3. Recommendation actions
- `accept(session)` stays available only for supported recommendation action types.
- `accept(plan)` supports `today`, `tomorrow`, and current-week target dates only.
- Reject drafts must survive dialog close/reopen.

## Validation

- Required local validation:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run test --workspaces --if-present`
  - `npm.cmd run build -w @sikao/web`
- Required acceptance gate:
  - independent review
  - frontend spec review
  - authenticated Chrome smoke for `/dashboard` and `/profile/learning`
