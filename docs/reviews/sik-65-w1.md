## Scope

- Review target: `SIK-65`
- Reviewed files:
  - `services/api/spec/openapi.json`
  - `services/api/tests/test_review_invariants.py`
  - `services/api/tests/test_debt_invariants.py`
  - `services/api/tests/test_taxonomy_invariants.py`
  - `services/api/tests/test_confidence_invariants.py`
  - `services/api/tests/test_srs_state_machine.py`
  - `services/api/tests/test_cross_tab_review.py`
  - `services/api/tests/test_openapi_drift.py`
- Reference docs:
  - `docs/vault/05-migration/Phase/Review/03-Backend-WU.md`
  - `docs/vault/05-migration/Phase/Review/01-Boundary-Rules.md`
  - `docs/vault/05-migration/Phase/Review/11-Testing.md`
  - `docs/vault/05-migration/Phase/Review/13-Cause-Taxonomy.md`
  - `docs/vault/05-migration/Phase/Review/14-Confidence-Rating.md`

## Findings

1. `High` `services/api/tests/test_review_invariants.py:5`
   Gate file was only a thin alias wrapper and did not explicitly lock the documented `PR-R1..PR-R11` matrix.

2. `High` `services/api/tests/test_srs_state_machine.py:41`
   SRS gate covered branch presence but not the promised interval math, probationary path details, or optimistic-lock semantics strongly enough.

3. `Medium` `services/api/tests/test_taxonomy_invariants.py:5`
   Taxonomy gate only covered cache/quota/override slices and did not reflect the full `TX1..TX15` matrix.

4. `Medium` `services/api/tests/test_confidence_invariants.py:5`
   Confidence gate only covered a subset of `C1..C15`, missing standard-advance, early-probation, and repeated-skip forcing semantics.

## Recommendations

- Promote `wrong_redo -> per_question` from assumption to enforced backend behavior.
- Turn review/taxonomy/confidence gate files into real invariant suites instead of alias shells.
- Strengthen SRS tests with exact interval assertions.

## Risk

- Overall risk: `High`
- Reason: final gate files could pass while leaving required Review-phase contracts effectively unlocked.
