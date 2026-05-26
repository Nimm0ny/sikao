# SIK-51 W1 Review

- Date: `2026-05-26`
- Mode: `Reviewer Mode` via independent subagent
- Issue: `SIK-51`
- Scope:
  - `docs/plan/sik-51-notes-community-contract.md`
  - `services/api/src/sikao_api/modules/notes_v2/domain/errors.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/community_policy.py`
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/community_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/note_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/tests/test_postgres_notes_community_v2.py`

## Round 1 Findings

1. `Medium` linked-question query-name drift
   - `linkedQuestionId` was the only accepted feed filter name, while the issue and backend docs still described `linked_question_id`.
   - Risk:
     - snake_case callers silently lost the question filter
     - community feed could return a wider public result set than intended
   - Resolution:
     - route now accepts both `linked_question_id` and `linkedQuestionId`
     - mismatched dual input now returns `422 validation_error`
     - regression coverage added for both spellings

2. `Low` create-public audit payload drift
   - `POST /api/v2/notes` with `visibility=public` wrote a visibility audit whose `before` shape differed from PATCH/PUT transitions.
   - Resolution:
     - audit payload now always carries `before.visibility` / `after.visibility`
     - create-public path reuses the same visibility-audit helper
     - regression coverage added for create-public audit shape and 50-character gate

## Final Re-review

- `No blocking findings`

## Reviewer Notes

- `public` 50-character gate is closed on all active write paths:
  - `POST /api/v2/notes`
  - `PUT /api/v2/notes/{id}`
  - `PATCH /api/v2/notes/{id}/visibility`
- community feed still restricts to `visibility='public' AND deleted_at IS NULL`
- `latest / hottest / featured` ordering still matches the issue contract
- static routes `/community` and `/{note_id}/visibility` remain ordered ahead of `/{note_id}`, so no dynamic-route swallowing regression was found

## Residual Risk

- `Low`
- Coverage now proves both snake_case and camelCase linked-question filtering, but there is still no dedicated regression that sends both names with conflicting values in the same request.
- The runtime guard exists and returns `422`, so this is a coverage gap rather than a known bug.

## Validation Evidence Reviewed

- `ruff` PASS
  - `services/api/src/sikao_api/modules/notes_v2/domain/errors.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/community_policy.py`
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/community_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/note_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/tests/test_postgres_notes_community_v2.py`
- `mypy` PASS
  - `MYPYPATH=services/api/src;services/api/tests`
  - `--explicit-package-bases`
- `pytest` PASS
  - `services/api/tests/test_postgres_notes_community_v2.py`
  - `services/api/tests/test_postgres_notes_crud_v2.py`
  - `services/api/tests/test_postgres_notes_search_query_v2.py`
  - `services/api/tests/test_postgres_notes_search_mutation_v2.py`
  - `services/api/tests/test_postgres_notes_search_audit_v2.py`
