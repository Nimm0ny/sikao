---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-28
---

# SIK-28 Practice Session Runtime Answer Contract

## Goal

Unblock `F20/F17` runtime resume by exposing enough session answer data for `/practice/sessions/:id` to rehydrate the current user answer instead of guessing from `status`.

## Current Evidence

- `PracticeSessionItemV2` only returns `id/question_key/prompt/answer_kind/status/flagged/...`; it has no answer payload.
- `SessionServiceV2._build_session_item()` reads `answer.response_json` only to derive `status="answered"`, then drops the actual answer.
- Current frontend can mark an item as answered in the sheet, but it cannot restore selected options or essay text on `continue last`.

## Define-First Boundary

- Extend `PracticeSessionItemV2` with a read-only normalized answer snapshot:
  - `selected_answer_keys: list[str] = []`
  - `answer_text: str | None = None`
- Keep write-side request shape unchanged: `POST /sessions/:id/answers` still accepts the existing flexible `answer` payload.
- Do not expose solutions, grading output, or scoring internals through this field.

## Rules

- Choice questions must serialize to `selected_answer_keys`; legacy `selected/selectedAnswer/selectedAnswerKeys` write variants normalize into this single read shape.
- Essay questions must serialize to `answer_text`; empty content stays `null`.
- Empty answers must remain explicitly empty (`[]` / `null`) so resume UI can distinguish `pending` from `answered`.

## Files Likely Impacted

- `services/api/src/sikao_api/db/schemas_v2.py`
- `services/api/src/sikao_api/modules/session/application/service.py`
- `packages/api-client/src/types/api.generated.ts`
- `packages/api-client/src/types/practice.ts`
- `apps/web/src/views/PracticeSession.tsx`

## Tests

- Backend response contract test for choice + essay snapshots.
- Frontend resume test asserting selected options / essay text hydrate from session detail.
- Regression test that `pending` items still render empty state.
