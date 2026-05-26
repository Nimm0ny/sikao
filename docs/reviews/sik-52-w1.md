# SIK-52 W1 Review

- Date: `2026-05-26`
- Mode: `Reviewer Mode` via independent subagent
- Issue: `SIK-52`
- Scope:
  - `docs/plan/sik-52-notes-backend-gate-contract.md`
  - `services/api/src/sikao_api/modules/notes_v2/application/audit.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/orphan_image_cleanup.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/ai_routes.py`
  - `services/api/src/sikao_api/modules/system/application/home_runtime.py`
  - `services/api/src/sikao_api/core/home_scheduler.py`
  - `services/api/tests/test_postgres_notes_audit_v2.py`
  - `services/api/tests/test_postgres_notes_orphan_image_cleanup_cron_v2.py`
  - `services/api/tests/test_home_scheduler_notes_jobs.py`
  - `services/api/tests/test_openapi_drift.py`
  - blocker-fix follow-up:
    - `services/api/src/sikao_api/modules/notes_v2/domain/body_extractor.py`
    - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
    - `services/api/src/sikao_api/modules/notes_v2/application/note_service.py`
    - `services/api/tests/test_postgres_notes_images_v2.py`

## Round 1 Findings

1. `High` orphan cleanup could delete images still referenced by note bodies
   - orphan uploads were persisted with `note_id=NULL`
   - note save flows did not bind referenced `/uploads/...` images back to `note_id`
   - cleanup would therefore delete still-referenced files after 24h
   - Resolution:
     - added image-source extraction from `body_json`
     - bound user-owned orphan images during note create/update
     - added request-level regression coverage

2. `High` orphan cleanup could escape `upload_dir` and fail whole batches on one file error
   - file deletion used a naive joined path without root containment
   - `unlink()` failures would roll back the entire sweep
   - Resolution:
     - cleanup now resolves and validates candidate paths under `upload_dir`
     - out-of-root paths are treated as unsafe and never physically deleted
     - per-file delete failures are now best-effort and carried in audit metadata
     - idempotent cleanup regression coverage added

## Final Re-review

- `No blocking findings`

## Reviewer Notes

- mutation-audit action names / targets / transaction boundaries remain aligned with the local M6 contract
- scheduler registration for `notes.orphan_image_cleanup` is unique and does not collide with existing Home / Review jobs
- OpenAPI drift path remains aligned to `services/api/spec/openapi.json` and `services/api/scripts/export_openapi.py`
- typed-only source fixes reviewed in the same pass did not surface obvious behavior regressions

## Residual Risk

- `Low`
- create-path orphan-image rebinding and update-path rebinding now share the same implementation, but only the update-path has explicit request-level regression coverage
- cleanup best-effort now preserves batch progress, though there is still no dedicated test that forces `unlink()` to raise `OSError` and asserts `delete_error` is populated

## Validation Evidence Reviewed

- targeted `ruff` / `mypy` PASS on touched `SIK-52` runtime and tests before sandbox regression
- targeted `pytest` PASS:
  - `services/api/tests/test_postgres_notes_audit_v2.py`
  - `services/api/tests/test_postgres_notes_orphan_image_cleanup_cron_v2.py`
  - `services/api/tests/test_home_scheduler_notes_jobs.py`
  - `services/api/tests/test_postgres_notes_ai_summary_routes_v2.py`
  - `services/api/tests/test_postgres_notes_weekly_review_routes_v2.py::test_postgres_notes_weekly_review_generate_and_replay`
  - `services/api/tests/test_openapi_drift.py`
