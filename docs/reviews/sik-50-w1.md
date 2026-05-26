# SIK-50 W1 Review

- Date: `2026-05-26`
- Mode: `Reviewer Mode` via independent subagent
- Issue: `SIK-50`
- Scope:
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/llm/application/quotas.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/ai_summary_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/weekly_review_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/ai_routes.py`
  - `services/api/tests/_helpers/practice_content_support.py`
  - `services/api/tests/test_notes_ai_summary_service_v2.py`
  - `services/api/tests/test_postgres_notes_ai_summary_routes_v2.py`
  - `services/api/tests/test_notes_weekly_review_service_v2.py`
  - `services/api/tests/test_notes_weekly_review_summary_v2.py`
  - `services/api/tests/test_postgres_notes_weekly_review_routes_v2.py`

## Round 1 Findings

1. `High` weekly replay / rate-limit semantics
   - Replay was tied to `(user, week, prompt_version)` cache hits, which blocked a legitimate second-generation attempt and made the weekly limit depend on note rows instead of attempts.
   - Resolution:
     - moved replay ownership to HTTP `Idempotency-Key`
     - allowed second generation on a new key
     - enforced third-attempt `429`
     - counted weekly attempts independently from soft-delete reopen behavior

2. `Medium` ai_summary confirm concurrency
   - `confirm_cards()` could race under concurrent confirms.
   - Resolution:
     - added `SELECT ... FOR UPDATE` on the cache row before confirm replay / creation.

3. `Medium` shared quota day boundary
   - shared quota was computed on a UTC day instead of the required UTC+8 day.
   - Resolution:
     - switched `HomeLlmQuotaService` day window to UTC+8.

4. `Medium` weekly invalid week input
   - invalid `week` values could escape as raw `ValueError`.
   - Resolution:
     - converted invalid week parsing into `422 validation_error`.

5. `Medium` true SSE semantics
   - weekly generation initially buffered the whole result before yielding a `chunk`.
   - Resolution:
     - switched back to real async chunk emission from the provider stream.

## Follow-up Review

- Result: `No blocking findings`
- Reviewer focus rechecked:
  - second different key generates a new weekly note
  - third generation in the same week returns `429`
  - ai_summary confirm now has row-lock protection
  - quota window now uses UTC+8
  - invalid `week` now returns `422`
  - weekly route still emits true SSE chunks

## Final Re-review

- Result: `No blocking findings`
- Final focus:
  - weekly different-key concurrency is protected at the service layer
  - weekly cache now tracks latest generation only
  - ai_summary confirm keeps row-lock protection
  - shared quota uses UTC+8 day boundaries
  - invalid `week` stays `422`
  - weekly SSE still yields real chunks

## Validation Evidence Reviewed

- `ruff` on touched runtime / test files: PASS
- `mypy` on touched runtime / helper files: PASS
- targeted Postgres/module suite:
  - `services/api/tests/test_notes_ai_summary_service_v2.py`
  - `services/api/tests/test_postgres_notes_ai_summary_routes_v2.py`
  - `services/api/tests/test_notes_weekly_review_service_v2.py`
  - `services/api/tests/test_notes_weekly_review_summary_v2.py`
  - `services/api/tests/test_postgres_notes_weekly_review_routes_v2.py`
  - Result: `13 passed`
- additional quota regression:
  - `services/api/tests/test_postgres_llm_service_call_quota_v2.py`
  - `services/api/tests/test_postgres_llm_service_purpose_quota_v2.py`
  - Result: `2 passed`
- true-provider manual smoke:
  - one real-provider `notes ai summary` preview call succeeded
  - observed `status=200`, `cards=2`, `cached=False`, `LlmCallV2.provider=system`, `parse_status=ok`

## Risk

- Residual risk: low
- Notes:
  - Weekly cache now tracks the latest successful generation for the week; HTTP replay stays keyed by `Idempotency-Key`.
  - The Postgres helper now uses `postgres` instead of `template1` for temporary database management to avoid local cluster contention during validation.

## Recommendation

- `SIK-50` is ready for commit / push / Evidence Block / done.
