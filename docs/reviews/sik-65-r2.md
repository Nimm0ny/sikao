## Scope

- Review target: `SIK-65`
- Re-reviewed files after first repair pass:
  - `services/api/spec/openapi.json`
  - `services/api/src/sikao_api/modules/session/application/service.py`
  - `services/api/tests/test_review_invariants.py`
  - `services/api/tests/test_taxonomy_invariants.py`
  - `services/api/tests/test_confidence_invariants.py`
  - `services/api/tests/test_srs_state_machine.py`
  - `services/api/tests/test_cross_tab_review.py`
  - `services/api/tests/test_openapi_drift.py`
  - `services/api/tests/test_postgres_practice_session_modes_v2.py`
  - `services/api/tests/test_postgres_review_recommendation_bridge_v2.py`
  - `services/api/tests/test_postgres_review_cause_analysis_edges_v2.py`

## Findings

1. `High` `services/api/tests/test_review_invariants.py:5`
   File was still mostly alias exports and still lacked explicit `PR-R2` and `PR-R7` coverage.

2. `Medium` `services/api/tests/test_confidence_invariants.py:5`
   File still missed direct gate coverage for `C5`, `C7`, and `C11`.

3. `Medium` `services/api/tests/test_taxonomy_invariants.py:12`
   File improved, but still missed `TX3`, `TX4`, `TX5`, and `TX15`.

## Recommendations

- Add local gate cases for `PR-R2` and `PR-R7`.
- Add backend forcing for repeated confidence skips (`C11`) and wire its tests into confidence gate.
- Add parser-level taxonomy tests for empty/uppercase/inactive slugs.

## Risk

- Overall risk: `Medium-High`
- Reason: runtime fix for `wrong_redo -> per_question` looked real, but invariant aggregation was still incomplete.
