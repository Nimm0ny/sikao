---
type: plan
status: accepted
owner: codex
last-reviewed: 2026-05-22
source: user-directive
---

# Home Backend-First Unblock Decision

## Background / Problem
- `2026-05-21` rebaseline already states `M3 / SIK-34` backend deliverables landed on `origin/main`, but legacy Home frontend runtime still trips the existing full frontend typecheck gate.
- If that legacy gate keeps blocking Home as a whole, `M4-M6` backend work and downstream backend consumers get serialized behind a paused frontend runtime track.
- The known full validation blocker at repo root is not an accurate release signal for backend-only Home work; it mostly reflects frontend migration debt.

## Decision
- Split Home into two tracks: active `backend-first` track = `M4-M6`; paused reference track = legacy frontend `M7-M12 / F1-F8`.
- Keep old Home frontend code in repo as reference, but do not treat "restart legacy runtime" or "clear frontend full typecheck first" as a prerequisite for `M4-M6`.
- For Home backend-first issues, authoritative validation scope is `services/api`; repo-root frontend full typecheck is context only, not a blocking gate for backend `M4-M6`, provided the task satisfies the root scoped-validation conditions.
- `M6` remains the backend contract lock point for downstream frontend, `api-client`, and later Home frontend rebuild work.

## Gate Impact
- `M0.5` only means: clear the legacy Home frontend full typecheck blocker before restarting legacy frontend runtime work. It does not gate `M4-M6`.
- `SIK-34` may remain `blocked` when that status only reflects legacy frontend gate debt; once `M3` backend deliverables are on `origin/main`, it must not be read as blocking Home backend `M4-M6`.
- Backend-only Home issues may use backend-first scoped validation when they do not include frontend runtime work and they satisfy the root validation-gate conditions.
- Backend-first issues still must satisfy define-first, review, and backend validation gates; they are not "validation optional".
- `2026-05-22` execution split for `WU-B8 / WU-B9 / WU-F1` is defined separately in `docs/plan/home-b8-b9-execution-baseline-2026-05-22.md`.

## Backend Validation Commands
```bash
cd services/api
python -m ruff check src tests
python -m mypy src
python -m pytest
```
- If the change touches migration or runtime schema: also run `alembic upgrade head`.
- If the change touches route/schema/OpenAPI contract: attach targeted API evidence from `services/api` tests before marking done.

## M0.5 / SIK-34 Semantics
- `M0.5` = a legacy frontend unblock task, not a Home phase global unlock.
- `SIK-34` = historical tracking issue for the old Home runtime gate; keeping it open or blocked does not roll back the backend-first milestone split.

## Non-Goals
- Not redefining the new Home frontend rebuild plan.
- Not closing `SIK-34` or claiming the legacy frontend blocker is solved.
- Not changing repo-root validation policy for mixed frontend/backend PRs.

## Risks
- Teams may misread a repo-root typecheck failure as "all Home blocked"; PRs must state when they are backend-first scoped.
- A later frontend rebuild can drift from backend contracts if `M6` OpenAPI and backend tests are not kept authoritative.
- Mixed-scope PRs can accidentally bypass frontend obligations; once a PR includes runtime frontend changes, this split no longer applies.
