---
type: plan
status: draft
owner: codex
last-reviewed: 2026-05-27
source: multica
multica-issue: SIK-102
---

# SIK-102 Review Frontend Data Contract

## Goal

Land the non-visual Review frontend data layer for Tab3:

- `packages/api-client/src/{types,queries}/review*`
- `packages/domain/src/review/*`
- MSW handlers and hook tests needed to make ReviewToday / ReviewAll / QuestionHub possible without placeholder data

This slice must stay honest to the current backend/runtime contract. It must not fabricate a second parallel Review API surface just because the historical frontend spec drifted.

## Requirement Source

- `multica issue get SIK-102 --output json`
- `docs/vault/05-migration/Phase/Review/04-Frontend-WU.md` (`WU-FR1`, `WU-FR2`)
- `docs/vault/05-migration/Phase/Review/07-Smart-Review-Aggregation.md`
- `docs/vault/05-migration/Phase/Review/08-Question-Hub-Page.md`
- `docs/vault/05-migration/Phase/Review/09-Cross-Tab-Wiring.md`
- current checked-in OpenAPI SSOT: `services/api/spec/openapi.json`

## Current Reality

### R1. Active issue mapping

Old Review frontend backlog `SIK-66~70` is historical. The active Tab3 tracker is:

- parent: `SIK-119`
- child API/data slice: `SIK-102`

Implementation should therefore target `SIK-102` while preserving semantic continuity with old `WU-FR1/FR2`.

### R2. Review frontend views are still skeletons

Current web views:

- [Review.tsx](/abs/path not emitted here)
- [QuestionHub.tsx](/abs/path not emitted here)

still render placeholder cards and do not consume Review runtime data.

### R3. Existing backend endpoints already cover most of SIK-102

Checked-in OpenAPI already exposes:

- `GET /api/v2/dashboard/today/review`
- `GET /api/v2/review/items`
- `GET /api/v2/review/items/{item_id}`
- `POST /api/v2/review/items`
- `PATCH /api/v2/review/items/{item_id}/{graduate|archive|restore}`
- `POST /api/v2/review/items/batch`
- `POST /api/v2/review/items/{item_id}/redo`
- `POST /api/v2/review/items/{item_id}/attempt`
- `POST /api/v2/review/items/{item_id}/cause-analysis`
- `POST /api/v2/review/cause-analysis/group`
- `PATCH /api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}`
- `POST /api/v2/review/cause-analysis/{analysis_id}/feedback`
- `GET /api/v2/review/cause-tags`
- `GET /api/v2/review/weekly-summary`
- `GET /api/v2/review/insights/{trends|causes|redo-accuracy}`
- `GET /api/v2/review/debt/{snapshot|plan}`
- `POST /api/v2/review/debt/{redistribute|skip-rampup}`

These should be wrapped, not duplicated.

### R4. One historical frontend dependency is missing in the live backend contract

Review docs still reference:

- `GET /api/v2/practice/answers?user_id=:id&limit=200&include_confidence=true&include_duration=true`

for the smart-card aggregation input and QuestionHub answer history.

This path does **not** exist in current OpenAPI or backend runtime.

That means `useRecentAnswers` cannot be honestly implemented without adding a small backend contract slice.

### R5. Historical docs imply more hooks than SIK-102 actually needs to finish now

The core `SIK-102` acceptance requires:

- query families
- 10 domain hooks
- smart-card pure-frontend algorithm tests

It does **not** require:

- visual components
- 1920 browser smoke
- route migration
- final QuestionHub desktop/mobile rendering

So this slice should prepare data/hooks for later visual waves without forcing M-Today/M-Hub component work into the same commit set.

## Contract Decisions

### D1. Query family split

Keep three query modules:

- `reviewQueries.ts`
- `causeAnalysisQueries.ts`
- `weeklyReviewQueries.ts`

Responsibility:

- `reviewQueries.ts`
  - review queue / detail / item mutations / today / smart / insights
- `causeAnalysisQueries.ts`
  - cause tags / single cause / group cause / dimension override / feedback
- `weeklyReviewQueries.ts`
  - weekly summary / debt snapshot / debt plan / debt mutations

### D2. `types/review.ts` becomes the typed SSOT wrapper

Add `packages/api-client/src/types/review.ts` that re-exports Review-specific generated schema/operation types from `api.generated.ts`, mirroring existing `types/home.ts` and `types/practice.ts`.

No extra handwritten DTOs unless the wire shape needs a frontend-only normalization helper.

### D3. Domain hook set for SIK-102

Create exactly these hooks under `packages/domain/src/review/`:

- `useReviewItems`
- `useReviewItem`
- `useReviewToday`
- `useSmartReviewCards`
- `useRecentAnswers`
- `useCauseAnalysis`
- `useGroupCauseAnalysis`
- `useWeeklyReview`
- `useReviewInsights`
- `useQuestionHub`
- `index.ts` barrel

Notes:

- `useSmartReviewCards` is the pure algorithm orchestrator
- `useQuestionHub` owns URL `ctx/review_id/session_id/note_id/topic_drill_seed/dim_focus` parsing
- `useRecentAnswers` is a fetch hook, not a local-only helper

### D4. Missing backend support added inside this slice

To make `useRecentAnswers` real, add a backend read endpoint:

- `GET /api/v2/practice/answers`

Minimum query parameters:

- `limit` default `200`, max `200`
- `include_confidence` default `false`
- `include_duration` default `false`

Auth:

- current user only
- no caller-supplied `user_id`

Response shape should be purpose-built for frontend aggregation instead of leaking full ORM rows.

### D5. `useRecentAnswers` contract

`useRecentAnswers` consumes the new backend endpoint and returns a normalized list with:

- `questionId`
- `isCorrect`
- `confidence`
- `answeredAt`
- `sessionId`
- `durationS`

It should not parse this from `/profile/records`, because that endpoint’s current shape does not expose enough answer-level fields.

### D6. Smart-card algorithm layering

`useSmartReviewCards` should be split into:

- pure calculation helpers exportable for unit tests
- a hook wrapper that composes:
  - `useReviewItems`
  - `useRecentAnswers`
  - optional future inputs

For this slice, implement the algorithm against the currently available inputs:

- `ReviewItemV2[]`
- recent answers list

Do not fake cause-tag or linked-note inputs that the live contract does not yet expose in a stable frontend-friendly way.

Where the larger spec references future extra inputs, keep helper signatures extensible with optional arrays.

### D7. MSW scope

Add a dedicated handler bundle:

- `apps/web/src/mocks/handlers/review.ts`

and compose it into:

- `apps/web/src/mocks/handlers.ts`

This handler file becomes the baseline mock source for Review queries/hooks. Per-test overrides can still use `server.use(...)`.

## Planned File Changes

Frontend:

- `packages/api-client/src/types/review.ts`
- `packages/api-client/src/queries/reviewQueries.ts`
- `packages/api-client/src/queries/causeAnalysisQueries.ts`
- `packages/api-client/src/queries/weeklyReviewQueries.ts`
- `packages/api-client/src/index.ts`
- `packages/domain/src/review/*.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/review/__tests__/*.test.ts(x)`
- `apps/web/src/mocks/handlers/review.ts`
- `apps/web/src/mocks/handlers.ts`

Backend support for missing contract:

- `services/api/src/sikao_api/modules/session/interface/routes.py` or the canonical Practice runtime route surface where answer-history reads belong
- related response schema additions in `services/api/src/sikao_api/db/schemas_v2.py`
- tests for the new read endpoint
- regenerated `services/api/spec/openapi.json`
- regenerated `packages/api-client/src/types/api.generated.ts`

## Validation Plan

Required for `SIK-102`:

- frontend:
  - targeted typecheck
  - lint
  - vitest query/hook tests
- backend support if added:
  - targeted `ruff`
  - targeted `mypy`
  - PostgreSQL request-level tests for `GET /practice/answers`
  - OpenAPI drift / regenerated types consistency

Review gate:

- independent subagent review is mandatory before `done`

## Not Doing In This Slice

- 1920 browser verification
- visual-contract files
- ReviewToday / QuestionHub / ReviewAll component rendering
- Note Tab work

Those belong to the subsequent visual waves under `SIK-103~106` / `SIK-107~111`.
