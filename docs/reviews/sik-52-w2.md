# SIK-52 W2 Review

- Date: `2026-05-27`
- Mode: `Reviewer Mode` via independent subagent
- Issue: `SIK-52`
- Scope:
  - `docs/plan/sik-52-notes-backend-gate-contract.md`
  - `services/api/src/sikao_api/modules/notes_v2/application/note_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/orphan_image_cleanup.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/weekly_review_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/ai_routes.py`
  - `services/api/tests/_helpers/practice_content_support.py`
  - `services/api/tests/test_notes_weekly_review_service_v2.py`
  - `services/api/tests/test_openapi_drift.py`
  - `services/api/tests/test_postgres_notes_images_v2.py`
  - `services/api/tests/test_postgres_notes_orphan_image_cleanup_cron_v2.py`
  - `services/api/tests/test_postgres_notes_weekly_review_routes_v2.py`

## Round 2 Findings

1. `High` orphan-image cleanup could still delete rows that were rebound after candidate selection
   - Evidence:
     - `weekly-review` fixes aside, cleanup previously selected stale `NoteImageV2` rows and later deleted them by loaded identity
     - orphan binding previously read candidate rows without row locks
   - Resolution:
     - cleanup now selects candidate ids first, then re-loads each row with `FOR UPDATE SKIP LOCKED` and `note_id IS NULL` before deleting
     - orphan binding now locks owned orphan image rows before rebinding them to a note
     - added PostgreSQL regression proving the guarded reload skips a row rebound after candidate selection

2. `High` weekly-review provider-build-fail path could self-deadlock on `users_v2` row locking
   - Evidence:
     - provider build failure records an `LlmCallV2` in an isolated session
     - the earlier implementation acquired `FOR UPDATE` on `users_v2` before provider construction, so the isolated insert’s FK check could block on the same user row
   - Resolution:
     - provider construction now happens before the user-row lock is taken
     - weekly limit and LLM quota checks now both run after `_lock_user_row()`
     - added a service-level regression that locks order to `lock -> weekly_limit -> quota`
     - PostgreSQL request-level `provider build fails` route test now completes and passes

3. `Medium` notes OpenAPI gate only asserted path presence, not required methods
   - Evidence:
     - contract D8 is method+path based
     - previous drift gate only checked `paths[...]` existence
   - Resolution:
     - drift test now asserts required HTTP methods for the multi-method Notes paths

## Final Re-review

- `No blocking findings`
- Final independent re-review after the method-level OpenAPI gate expansion also reported `no blocking findings`

## Reviewer Notes

- `build_postgres_client()` now disposes the app engine before temp-db teardown; no regression surfaced in rerun PostgreSQL notes suites
- orphan cleanup still uses best-effort file deletion, but DB row deletion is now guarded against stale orphan snapshots
- the weekly-review locking fix preserves the original goal: config/build failures do not hold the long-lived user lock, while quota and weekly-limit checks remain serialized

## Residual Risk

- `Low`
- PostgreSQL notes suites still emit historical Alembic `sorted_tables` warnings from `0001_initial.py`; these are noisy but not new in this change set
- the OpenAPI snapshot remains a large generated artifact, so future contract churn should keep `test_openapi_drift.py` method assertions aligned

## Validation Evidence Reviewed

- `wsl.exe bash -lc 'cd /mnt/d/py_pj/sikao/services/api && .venv/bin/ruff check src tests'`
- `wsl.exe bash -lc 'cd /mnt/d/py_pj/sikao/services/api && .venv/bin/mypy --config-file pyproject.toml src'`
- `wsl.exe bash -lc 'cd /mnt/d/py_pj/sikao/services/api && .venv/bin/python -m alembic -c /mnt/d/py_pj/sikao/database/migrations/alembic.ini upgrade head'`
- `wsl.exe bash -lc 'cd /mnt/d/py_pj/sikao/services/api && TEST_POSTGRESQL_URL="postgresql+psycopg://postgres@127.0.0.1:5432/postgres" .venv/bin/python -m pytest --cache-clear -q tests/test_postgres_notes_images_v2.py tests/test_postgres_notes_orphan_image_cleanup_cron_v2.py tests/test_postgres_notes_weekly_review_routes_v2.py tests/test_openapi_drift.py tests/test_notes_weekly_review_service_v2.py'`
- additional PostgreSQL route/file reruns:
  - `tests/test_postgres_notes_ai_summary_routes_v2.py`
  - `tests/test_postgres_notes_search_query_v2.py tests/test_postgres_notes_search_mutation_v2.py tests/test_postgres_notes_search_audit_v2.py tests/test_postgres_notes_search_degrade_v2.py tests/test_postgres_notes_community_v2.py`
