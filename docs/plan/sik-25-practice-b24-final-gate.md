# SIK-25 Practice B24 Final Gate

## Context

- Issue: `SIK-25`
- Phase: `Practice`
- Slice: `B24`
- Goal: lock backend contract and final acceptance evidence after `B20 / B23 / B28 / B30` are all landed.

## Requirement Source

- `docs/vault/05-migration/Phase/Practice/03-Backend-WU.md` section `16`
- `docs/vault/05-migration/Phase/Practice/10-Testing.md` section `6.1`
- `docs/vault/05-migration/Phase/Practice/README.md` section `8.1`
- existing contract harness: `services/api/tests/test_home_phase_m6_contract_lock.py`

## Scope

In scope:

- checked-in `services/api/spec/openapi.json` must match `create_app().openapi()`
- checked-in `packages/api-client/src/types/api.generated.ts` must match regenerated output
- add explicit backend e2e for `question_report_admin_loop`
- collect final backend PASS evidence for the Practice-only final gate

Out of scope:

- frontend visual work
- new product behavior beyond final-gate proof

## Gate Definition

### Contract lock

- `services/api/scripts/export_openapi.py` remains the only backend export entrypoint
- `services/api/spec/openapi.json` is regenerated and committed
- `packages/api-client/src/types/api.generated.ts` is regenerated from the committed spec
- `services/api/tests/test_home_phase_m6_contract_lock.py` must pass without local patching

### Explicit B25-B30 proof set

The final backend gate for this issue must include direct PASS evidence for:

- `ai_questions` fallback / failure semantics
- `daily_practice` generation and session handoff semantics
- `question_report` user flows
- `question_report` admin status/apply-fix flows
- `question_report` cleanup hook with AI vs real-exam split
- `practice_preferences` contract behavior
- `mock_exam` force submit path
- `timing / session_lifecycle` invariants already covered by existing route-level suites when selected

### New test to add

- `question_report_admin_loop`
  - user creates report
  - admin acknowledges
  - admin applies fix
  - question field mutation persists
  - dual audit persists
  - user list reflects resolved state

## Validation Plan

- `ruff check` for changed files
- `mypy` for changed code
- `pytest services/api/tests/test_home_phase_m6_contract_lock.py -q`
- `pytest` over the final B24 gate bundle after regeneration:
  - `test_ai_questions_generate_v2.py`
  - `test_ai_questions_generate_failfast_v2.py`
  - `test_postgres_ai_questions_generate_v2.py`
  - `test_daily_practice_v2.py`
  - `test_postgres_daily_practice_v2.py`
  - `test_practice_question_reports_user_v2.py`
  - `test_postgres_question_report_invariants_v2.py`
  - `test_postgres_question_report_admin_status_queue_v2.py`
  - `test_postgres_question_report_admin_status_negative_v2.py`
  - `test_postgres_question_report_apply_fix_options_v2.py`
  - `test_postgres_question_report_apply_fix_text_v2.py`
  - `test_postgres_question_report_admin_loop_v2.py`
  - `test_postgres_ai_cleanup_cron_v2.py`
  - `test_postgres_ai_cleanup_with_question_reports_v2.py`
  - `test_practice_question_flag_access_v2.py`
  - `test_practice_favorites_scope_v2.py`
- for repo-level full pytest, use `workdir=services/api` and include `PYTHONPATH=<repo_root>;services/api/src` so root `scripts/import/*` stay canonical during collection
- independent subagent review before claiming B24 complete
