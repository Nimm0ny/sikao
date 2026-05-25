## Scope

- Review target: `SIK-48`
- Review mode: independent subagent code review
- Reviewed files:
  - `docs/plan/sik-48-notes-tags-image-export-contract.md`
  - `services/api/pyproject.toml`
  - `database/migrations/alembic/versions/1032_notes_image_nullable.py`
  - `services/api/src/sikao_api/db/models_v2.py`
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/errors.py`
  - `services/api/src/sikao_api/modules/notes_v2/domain/tiptap_converter.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/repos.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/tag_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/image_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/application/export_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/tests/test_notes_phase_n2_schema_contract.py`
  - `services/api/tests/test_postgres_notes_tags_v2.py`
  - `services/api/tests/test_postgres_notes_images_v2.py`
  - `services/api/tests/test_postgres_notes_export_v2.py`

## Findings

1. `Medium` [export_service.py](/D:/py_pj/sikao/services/api/src/sikao_api/modules/notes_v2/application/export_service.py:38)
   Frontmatter was originally assembled by raw string interpolation, so YAML-sensitive title/tag characters could corrupt exported markdown.

2. `Low` [test_postgres_notes_export_v2.py](/D:/py_pj/sikao/services/api/tests/test_postgres_notes_export_v2.py:45)
   Export markdown assertions were initially too weak to prove correct image markdown output and escaping.

3. `Low` [test_postgres_notes_tags_v2.py](/D:/py_pj/sikao/services/api/tests/test_postgres_notes_tags_v2.py:84)
   The system-tag fixture originally hardcoded `user_id=1`, making the test rely on primary-key allocation order.

## Recommendation

- Serialize frontmatter values safely.
- Strengthen the export assertions into exact-output or snapshot-like checks.
- Bind the system-tag setup to the actual registered user id.

## Risk

- Overall risk: `Medium`
- Reason: tags/image/export runtime looked directionally correct, but export safety and test hardness were not yet fully closed.
