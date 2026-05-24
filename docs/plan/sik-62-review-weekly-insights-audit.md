# SIK-62 Review Weekly + Insights + Audit

## Context

- Issue: `SIK-62`
- Phase: `Review`
- Milestone: `M4`
- Slice set: `WU-R7 + WU-R8 + WU-R9`
- Goal: land Review's weekly summary, insights read models, and audit/observability layer on top of `SIK-60` + `SIK-61`.

## Requirement Source

- `docs/vault/05-migration/Phase/Review/03-Backend-WU.md` sections `WU-R7`, `WU-R8`, `WU-R9`
- `docs/vault/05-migration/Phase/Review/10-NonFunctional.md`
- `docs/vault/05-migration/Phase/Review/11-Testing.md`
- `docs/vault/05-migration/Phase/Review/00-Decisions.md`
- current repo runtime after `SIK-61`

## Reality Check

### 1. Scheduler substrate already exists and is not greenfield

Current repo already has:

- `sikao_api.core.home_scheduler.HomeScheduler`
- `sikao_api.modules.system.application.home_runtime.HomeRuntimeOrchestrator`
- production-like APScheduler registration in FastAPI lifespan

Decision:

- `SIK-62` must extend the current Home scheduler/runtime rails
- do not create a second scheduler abstraction
- new Review jobs belong beside the existing Home/Practice jobs in `HomeScheduler.schedule_recurring_jobs()`

### 2. The issue body's `metadata_json` storage note is stale

The `WU-R7` issue text says:

- weekly cron precomputes a snapshot and "writes into metadata_json"

Repo reality:

- there is no user-level Review metadata host
- `ReviewItemV2.metadata_json` is per-item and therefore the wrong scope
- `ProfileInfoV2.dashboard_preferences` / `recommender_preferences` are user-editable preference blobs, not durable system-owned snapshots
- current repo already uses dedicated snapshot tables for other precomputed views:
  - `ProgressSnapshotV2`
  - `WeaknessSnapshotV2`

Decision:

- `SIK-62` will add `ReviewWeeklySnapshotV2`
- do not overload `ProfileInfoV2.*preferences`
- do not shoehorn user-level weekly summaries into per-item metadata
- `ReviewWeeklySnapshotV2` is a **system-owned read model/cache only**
- future weekly notes are user-facing artifacts derived from the snapshot, not the
  source of truth for weekly summary data

### 3. Weekly note generation is not actually implementable on current Notes schema

Accepted docs mention:

- weekly review can generate a note
- `WeeklySummaryResponseV2.generated_note_id`

Repo reality:

- `NoteV2` has no `type` field
- there is no committed backend contract for `weekly_review` note typing

Decision:

- `SIK-62` does **not** implement weekly note creation
- `generated_note_id` remains a nullable compatibility field and returns `null`
- note generation stays for a later Notes/Review cross-slice

### 4. "Graduated" in old weekly/insights docs drifts from current SRS reality

Current runtime after `SIK-60`:

- mastery first transitions to `probationary`
- final `graduated` only happens after a later probation check
- manual "已掌握" also lands `probationary` through `mark_resolved`

If `SIK-62` only counts final `graduated`:

- recent user-perceived mastery wins are undercounted
- manual graduate actions disappear from weekly/trend summaries

Decision:

- `InsightsDayPoint.graduated`
- `WeeklySummaryResponseV2.new_graduated_count`

will count **mastery transitions**, defined as:

- `ReviewAttemptOutcome.PROBATION_ENTERED`
- `ReviewAttemptOutcome.GRADUATED`

This keeps the field name for contract compatibility while aligning to the actual `probationary`-first SRS flow.

### 5. Existing audit primitive is already `add_audit_log`

Repo already standardizes audit persistence through:

- `sikao_api.modules.system.application.audit_v2.add_audit_log`

Current Review runtime does not yet emit enough audit events for:

- archive
- restore
- graduate / mark_resolved
- cause-analysis request / cache hit / failure / success
- weekly snapshot generation

Decision:

- `SIK-62` adds a small Review audit helper layer that delegates to `add_audit_log`
- do not create a second audit table or a custom logger-only pseudo-audit path

### 6. Metrics style in this repo is OpenTelemetry, not a custom in-memory counter module

Repo reality:

- `home_scheduler.py` already uses `opentelemetry.metrics`
- no dedicated Review metrics module exists yet

Decision:

- `SIK-62` adds `review/application/metrics.py` using OpenTelemetry meter style
- do not implement a bespoke "Prometheus-style counter" abstraction disconnected from current app practice

### 7. Insights causes must use single-analysis rows only

Current `SIK-61` introduced:

- `scope=single`
- `scope=group`

If `insights/causes` aggregates both:

- the same weakness can be double-counted via per-item and grouped analysis
- group-level synthetic summaries can dominate frequency charts

Decision:

- `insights_causes` aggregates `AiCauseAnalysisV2.scope == 'single'` only
- use `effective_slug` semantics (`user_override.slug_overridden` first, otherwise `slug`)

### 8. Review cause-analysis metrics must be backfilled onto `SIK-61` paths

`WU-R9` explicitly expects counters around:

- cause-analysis calls
- cause-analysis cache hits

But `SIK-61` did not yet add those counters.

Decision:

- `SIK-62` is allowed to touch `cause_analysis_service.py` to add metrics/audit instrumentation
- this is not treated as scope creep; it is the observability layer for the already-landed cause-analysis runtime

## Scope

In scope:

- weekly snapshot table + cron + fallback route
- three review insights endpoints
- Review audit helper layer
- Review metrics helper layer
- backfilling audit/metrics into existing review CRUD and cause-analysis paths
- PostgreSQL-first tests for cron idempotency, insights windows, and audit/metric side effects

Out of scope:

- weekly note generation
- debt / recommendation bridge
- frontend work
- extra Notes schema changes

## Boundary Decisions

### 1. New table

`SIK-62` adds:

- `ReviewWeeklySnapshotV2`

Columns:

- `id`
- `user_id`
- `week_start_date`
- `data_json`
- `created_at`
- `updated_at`

Constraint:

- unique `(user_id, week_start_date)`

Rationale:

- mirrors current `ProgressSnapshotV2` / `WeaknessSnapshotV2` storage style
- keeps the summary system-owned and idempotent

### 2. New cron job

`HomeScheduler` adds:

- `review.weekly_summary.snapshot`

Trigger:

- every Monday `02:00`
- timezone = `settings.home_scheduler_timezone`

Runtime entrypoint:

- `HomeRuntimeOrchestrator.run_review_weekly_summary_snapshot()`

### 3. Weekly summary route

Route:

- `GET /api/v2/review/weekly-summary?week=YYYY-WW`

Behavior:

- if a snapshot row exists for that ISO week => return it
- otherwise => compute live from current data and return without persisting

Compatibility field:

- `generated_note_id` always `null` in `SIK-62`

### 4. Weekly summary response shape

Response fields:

- `week`
- `items_reviewed`
- `redo_accuracy_pct`
- `new_notes_count`
- `new_graduated_count`
- `generated_note_id`
- `biggest_progress`
- `biggest_concern`
- `next_week_focus`

`biggest_progress` in `SIK-62`:

- one question-level highlight derived from improvement in review outcomes and confidence trend

`biggest_concern` in `SIK-62`:

- one concern string derived from the highest-frequency effective cause slug
- may append confidence/debt signals when available

### 5. Insights routes

Add:

- `GET /api/v2/review/insights/trends`
- `GET /api/v2/review/insights/causes`
- `GET /api/v2/review/insights/redo-accuracy`

Window:

- rolling 90 days

### 6. Trends aggregation contract

Per day:

- `new_incorrect`
  - count new `ReviewItemV2` rows created that day from:
    - `wrong_answer`
    - `re_failed`
    - `manual_add`
    - `flagged_persistent`
- `graduated`
  - count mastery transitions that day:
    - `probation_entered`
    - `graduated`
- `net_accumulation`
  - real active backlog delta:
    - `+1` on new queue item creation
    - `-1` on archive
    - `+1` on restore
    - `-1` on mastery transition

### 7. Redo accuracy aggregation contract

Per week:

- `total_attempts`
  - count review answer attempts represented by outcomes:
    - `correct`
    - `incorrect`
    - `probation_entered`
    - `graduated`
    - `probation_failed`
- `correct_count`
  - count:
    - `correct`
    - `probation_entered`
    - `graduated`
- `accuracy_pct`
  - `0.0` when denominator is zero

Exclude:

- `created`
- `archived`
- `restored`
- `mark_resolved`
- `cause_tag_overridden`

### 8. Cause-frequency aggregation contract

Source rows:

- `AiCauseAnalysisV2.scope == 'single'`
- created within the 90-day window

For each dimension:

- slug source = `effective_slug`
- bucket by effective slug display name
- increment `severity_distribution[severity]`

### 9. Audit contract

New Review audit actions in `SIK-62`:

- `review.item.archived`
- `review.item.restored`
- `review.item.mark_resolved`
- `review.cause_analysis.requested`
- `review.cause_analysis.cache_hit`
- `review.cause_analysis.completed`
- `review.cause_analysis.failed`
- `review.weekly_summary.snapshot_generated`

### 10. Metrics contract

New OpenTelemetry counters:

- `review_srs_mastery_transitions_total`
- `review_item_archived_total`
- `review_item_restored_total`
- `review_cause_analysis_requests_total`
- `review_cause_analysis_cache_hits_total`
- `review_cause_analysis_failures_total`
- `review_weekly_snapshots_generated_total`

New histogram:

- `review_cause_analysis_duration_ms`

### 11. No dedicated new limiter layer

`SIK-62` reuses current runtime behavior:

- no new HTTP limiter for weekly/insights reads
- existing cause-analysis quota behavior remains in place

## Planned File Changes

- `docs/plan/sik-62-review-weekly-insights-audit.md`
- `database/migrations/alembic/versions/1029_review_weekly_snapshot.py`
- `services/api/src/sikao_api/db/models_v2.py`
- `services/api/src/sikao_api/db/schemas_v2.py`
- `services/api/src/sikao_api/core/home_scheduler.py`
- `services/api/src/sikao_api/modules/system/application/home_runtime.py`
- `services/api/src/sikao_api/modules/review/application/weekly_service.py`
- `services/api/src/sikao_api/modules/review/application/insights_service.py`
- `services/api/src/sikao_api/modules/review/application/audit.py`
- `services/api/src/sikao_api/modules/review/application/metrics.py`
- `services/api/src/sikao_api/modules/review/application/service.py`
- `services/api/src/sikao_api/modules/review/application/cause_analysis_service.py`
- `services/api/src/sikao_api/modules/review/interface/routes.py`
- scheduler tests
- weekly/insights/audit PostgreSQL tests

## Validation Plan

Primary evidence:

- migration adds weekly snapshot table and unique constraint
- scheduler registers weekly review snapshot job at the intended wall clock
- cron rerun is idempotent
- weekly route returns snapshot when present and fallback when absent
- insights 90-day windows behave correctly for empty and non-empty datasets
- audit rows exist for archive / restore / mark_resolved / cause-analysis / weekly snapshot
- metrics counters advance on real runtime paths, including:
  - mastery transition
  - cause-analysis cache hit
  - cause-analysis failure

Scoped validation target:

- `ruff` on changed files
- `mypy` on changed review/system/db files
- PostgreSQL targeted pytest for weekly/insights/audit/runtime
- scheduler unit tests
- OpenAPI spec regeneration + generated client regeneration
- `python -m pytest services/api/tests/test_home_phase_m6_contract_lock.py -q`

Explicit closeout rule:

- this issue cannot be marked done without an independent subagent review
- if weekly note generation stays deferred, final Evidence Block must say `generated_note_id=null by design in SIK-62`
