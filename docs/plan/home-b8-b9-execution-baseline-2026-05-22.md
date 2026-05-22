---
type: plan
status: accepted
owner: codex
last-reviewed: 2026-05-22
source: user-directive
---

# Home B8/B9 Execution Baseline (2026-05-22)

## Background
- `2026-05-21` rebaseline already split Home into active backend-first `M4-M6` and paused legacy frontend `M7-M12 / F1-F8`.
- `SIK-36 / WU-B8` needs a Define-First execution baseline before code continues, because the previous split assumed a simpler `B8.1-B8.4` flow and left scheduler selection mostly in comments.
- `SIK-37 / WU-B9` can now overlap with `SIK-36`, but only as prep work until the `B8` runtime hooks stabilize.

## Decisions
- Home scheduler stays on the documented Stage 1 path: embedded `APScheduler` inside FastAPI lifespan.
- Stage 1 is single-instance only: `MemoryJobStore`, no `SQLAlchemyJobStore`, no multi-worker DB locking, no `services/worker`.
- Existing profile deletion scheduler is not reused as the Home runtime implementation. We may reuse its lifespan discipline only.
- `B8.1a` must expose an explicit job execution seam: Home jobs run against a typed `HomeSchedulerContext` carrying at least `Settings` and `DatabaseManager`, so later DB-backed jobs do not force another substrate redesign.
- `SIK-37` is split into:
  - `B9-prep`: non-cron e2e, OpenAPI export/drift harness, shim assertion matrix
  - `B9-lock`: cron/login/submit-refresh final assertions, shim removal, checked-in spec/types lock
- `SIK-38 / WU-F1` remains paused as legacy frontend runtime work. Only prep artifacts are allowed before a later explicit restart decision.

## B8 Execution Split
- `B8.0`: Define-First + issue/doc baseline alignment
- `B8.1a`: APScheduler substrate only
- `B8.1b`: `progress_snapshot` + `event_status_tick` jobs
- `B8.2`: `weakness_snapshot` cron + submit-progress side-effect boundary
- `B8.3a`: `plan_adjustor_daily` + cleanup job logic
- `B8.3b`: login hook + skipped hook wiring
- `B8.4`: `session.submit -> async recommender refresh`

## Concurrency Rules
- `B8.1a` is the only required front-of-queue blocker. No Home cron/job wiring starts before substrate lands.
- Any work that edits `SessionServiceV2.submit()` must be serialized. `B8.2` and `B8.4` cannot run as overlapping code changes.
- `B9-prep` may start after `B8.1a` contract is fixed, but must not delete `/api/v2/dashboard/records`, regenerate checked-in `openapi.json`, or regenerate checked-in `api.generated.ts`.
- `B9-lock` starts only after all `B8` runtime hooks are stable.

## Validation Rules
- Home backend-only work uses backend-first scoped validation, not repo-root full validation.
- Required baseline commands:
```bash
cd services/api
PYTHONPATH=src python -m ruff check src tests
PYTHONPATH=src python -m mypy src
PYTHONPATH=src python -m pytest
```
- If migrations or runtime schema change: also run `alembic upgrade head`.
- Final reports must explicitly state that repo-root `npm run typecheck` is still blocked by unrelated frontend migration debt.

## SIK-37 / SIK-38 Semantics
- `SIK-37` locks backend contracts for future frontend rebuild, `api-client`, and other downstream consumers. It no longer implies that legacy `M7` starts immediately.
- `SIK-38` is not the current mainline successor to `SIK-37`. Before any runtime implementation begins, it still requires `M6`, `M0.5`, and a new frontend rebuild plan to be explicitly approved.
