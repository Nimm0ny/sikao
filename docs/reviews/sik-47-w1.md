## Scope

- Review target: `SIK-47`
- Review mode: independent subagent code review
- Reviewed files:
  - `docs/plan/sik-47-notes-crud-contract.md`
  - `database/migrations/alembic/versions/1031_notes_crud_contract.py`
  - `services/api/src/sikao_api/db/models_v2.py`
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/note_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/service.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/body_extractor.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/content_hash.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/tiptap_converter.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/tests/test_notes_phase_n1_schema_foundation.py`
  - `services/api/tests/test_notes_content_derivation.py`
  - `services/api/tests/test_postgres_notes_crud_v2.py`

## Findings

1. `High` [1031_notes_crud_contract.py](/D:/py_pj/sikao/database/migrations/alembic/versions/1031_notes_crud_contract.py:56)
   Migration backfilled `word_count` with `LENGTH(body)`, which diverged from the canonical runtime derivation for mixed CJK / non-CJK content.

2. `High` [note_service.py](/D:/py_pj/sikao/services/api/src/sikao_api/modules/notes_v2/application/note_service.py:155)
   `update_note()` did not re-derive `note.type` when `linked_question_id` changed, allowing persisted `type/link` drift.

3. `Medium` [note_service.py](/D:/py_pj/sikao/services/api/src/sikao_api/modules/notes_v2/application/note_service.py:197)
   `serialize_note()` hardcoded `author_name=None`, leaving the response contract under-filled.

## Recommendation

- Fix the three issues above before closeout.
- Add regression assertions for exact migration word count, type relink behavior, and author-name population.

## Risk

- Overall risk: `Medium-high`
- Reason: core owner-isolation and CRUD shape were mostly sound, but derived metadata and canonical type semantics were not yet trustworthy.
