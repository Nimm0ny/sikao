## Scope

- Review target: `SIK-49` first independent subagent review
- Review mode: search backend / filter / isolation review
- Reviewed files:
  - `services/api/src/sikao_api/modules/notes_v2/application/search_service.py`
  - `services/api/src/sikao_api/modules/notes_v2/infrastructure/meilisearch_client.py`
  - `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
  - `services/api/tests/test_postgres_notes_search_v2.py`
  - `services/api/tests/_helpers/notes_search_support.py`

## Findings

1. `High` [search_service.py](/D:/py_pj/sikao/services/api/src/sikao_api/modules/notes_v2/application/search_service.py:156)
   Raw `tags` filter content was previously interpolated into the Meilisearch filter string without safe escaping, leaving a user-isolation bypass risk.

2. `Medium` [search_service.py](/D:/py_pj/sikao/services/api/src/sikao_api/modules/notes_v2/application/search_service.py:191)
   Multi-tag filter semantics previously drifted from Notes list behavior by treating `tags:a|b` as union rather than the repo's existing intersection model.

3. `Medium` [notes_search_support.py](/D:/py_pj/sikao/services/api/tests/_helpers/notes_search_support.py:90)
   The first mock filter interpreter was too permissive and could let invalid filter grammar or precedence issues pass in tests.

4. `Medium` [test_postgres_notes_search_v2.py](/D:/py_pj/sikao/services/api/tests/test_postgres_notes_search_v2.py:91)
   Search response coverage initially missed key DTO fields and did not exercise the hit decode path directly.

## Recommendation

- Escape and quote filter literals safely.
- Align repeated tag filtering with existing Notes list semantics.
- Harden the mock filter interpreter to reject unsupported clauses.
- Add explicit response-contract coverage for highlights, previews, linked ids, and timestamp formatting.

## Risk

- Overall risk: `Medium-High`
- Reason: the first-wave isolation bug was real user-facing risk, and the original tests were not strong enough to catch it.
