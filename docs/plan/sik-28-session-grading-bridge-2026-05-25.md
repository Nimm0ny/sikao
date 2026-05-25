---
type: plan
status: active
owner: codex
created: 2026-05-25
updated: 2026-05-25
mode: Runner
issue: SIK-28
---

# SIK-28 Session Grading Bridge

## Problem

`/practice/sessions/:id/grading` is a locked frontend route in the Practice phase docs, but the current grading API and legacy links still key essay grading by `submission_id`.

Current gaps:

- `PracticeSessionEnvelopeV2` does not expose the linked `EssaySubmissionV2.id`.
- runtime router does not register `/practice/sessions/:id/grading`.
- Home/Profile learning records and session result actions still emit older essay grading hrefs.

## Decision

Keep `submission_id` as the grading API primary key, but bridge it to the session runtime:

1. Extend `PracticeSessionEnvelopeV2` with optional `essay_submission_id`.
2. Populate it from `EssaySubmissionV2.practice_session_id`.
3. Add canonical frontend route `/practice/sessions/:id/grading`.
4. Keep legacy frontend submission-based grading paths readable as compatibility routes.
5. Canonicalize newly emitted frontend-facing hrefs to `/practice/sessions/:id/grading` when the practice session is known.

## Why

- avoids redefining the existing grading backend API surface;
- keeps old links usable while moving new flows to the canonical Practice runtime path;
- lets `SIK-28` close without leaving Home/Profile drill-down links split between old and new URL shapes.
