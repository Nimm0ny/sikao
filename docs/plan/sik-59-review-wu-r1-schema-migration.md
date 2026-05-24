# SIK-59 Review WU-R1 Schema Migration

## Context

- Issue: `SIK-59`
- Phase: `Review`
- Slice: `WU-R1`
- Goal: land the first Review backend schema foundation on top of the current phase1-v2 runtime, without following stale pre-v2 migration numbering.

## Requirement Source

- `docs/vault/05-migration/Phase/Review/00-Decisions.md`
- `docs/vault/05-migration/Phase/Review/01-Boundary-Rules.md`
- `docs/vault/05-migration/Phase/Review/02-Data-Model.md`
- `docs/vault/05-migration/Phase/Review/03-Backend-WU.md` section `WU-R1`
- Multica issue `SIK-59`

## Reality Check

Current repo reality differs from the issue summary in three places:

1. Migration numbering
   - issue text still says `0030_review_extend_review_items_v2`
   - actual repo head is `1026_question_report.py`
   - implementation must use the live alembic chain and add a new `1027_*` revision

2. Schema source of truth
   - current ORM is `services/api/src/sikao_api/db/models_v2.py`
   - `ReviewItemV2` already exists as a stub table
   - the live field name is `source_kind`, not the older `reason` wording seen in parts of the Review docs
   - `reason` was added later by Practice `1018_review_item_reason.py` and must remain intact

3. Validation substrate
   - repo keeps many SQLite migration drift guards
   - this issue must not use SQLite as the main acceptance evidence
   - PostgreSQL migration round-trip and runtime smoke are the authoritative validation path for this task

## Scope

In scope:

- add `db/enums_v2.py` for Review phase string enums used by schema and later application slices
- extend `ReviewItemV2` with Review WU-R1 SRS foundation columns
- add missing Review indexes required by `02-Data-Model.md`
- add `AiCauseAnalysisV2`
- add one new alembic revision after `1026_question_report.py`
- add PostgreSQL-first migration/runtime tests for:
  - fresh upgrade
  - upgrade from pre-WU-R1 head with existing data
  - downgrade back to `1026_question_report`
  - runtime metadata / `create_app()` smoke after migrated head

Out of scope:

- review CRUD / list filters / cause-analysis endpoints
- SRS engine logic
- cron / hooks / LLM integration
- frontend and OpenAPI regeneration

## Boundary Decisions

### 1. ReviewItemV2 columns to add now

Add the columns that later Review slices need as stable schema:

- `correct_streak INTEGER NOT NULL DEFAULT 0`
- `next_review_at DATETIME NULL`
- `version INTEGER NOT NULL DEFAULT 1`

Rationale:

- `correct_streak` and `next_review_at` are explicitly required by `SIK-59`
- `version` is already fixed by accepted Review decisions (`SRS-2`, `SRS-8`) as a core SRS state field, and the accepted SRS docs use `1` as the initial CAS baseline
- adding `version` now avoids a second schema churn before WU-R3/WU-R4

### 2. ReviewItemV2 columns not promoted yet

Do not add separate top-level columns yet for:

- `algorithm_version`
- `ease_factor`
- `interval_days`
- `repetitions`
- `used_recall`
- `last_answer_hash`
- `first_seen_at`
- `last_reviewed_at`
- `graduated_at`
- `archived_at`

Rationale:

- accepted Review docs already allow these to live in `metadata_json`
- promoting all of them now would expand WU-R1 beyond the issue slice and force unnecessary runtime touch points before any writer path exists
- WU-R1 only needs the index-bearing SRS state columns at table top level

### 3. ReviewItemV2 status enum scope

`db/enums_v2.py` must define `ReviewItemStatus` with:

- `pending`
- `in_progress`
- `probationary`
- `graduated`
- `archived`

Runtime model stays `String(32)` for now.

Rationale:

- Review docs already treat `probationary` as target-state contract
- current routes may still only write `pending`; adding enum coverage now is schema-safe and forward compatible

### 4. AiCauseAnalysisV2 shape

Create `ai_cause_analysis_v2` with:

- `id`
- `user_id`
- `scope`
- `question_id`
- `question_ids_signature`
- `input_hash`
- `result_json`
- `llm_call_id`
- `created_at`
- `expires_at`
- `CHECK` invariant:
  - `scope='single'` => `question_id IS NOT NULL AND question_ids_signature IS NULL`
  - `scope='group'` => `question_id IS NULL AND question_ids_signature IS NOT NULL`

Do not add extra optimistic-lock or taxonomy columns in WU-R1.

Rationale:

- this matches `02-Data-Model.md` section `3.3`
- later WU-R5/WU-R13 can extend application semantics without inflating this first schema slice

### 5. Enum module strategy

Create `services/api/src/sikao_api/db/enums_v2.py` using `StrEnum`.

Initial enum set:

- `ReviewSourceKind`
- `ReviewItemStatus`
- `ReviewAttemptOutcome`
- `CauseAnalysisScope`

DB columns remain plain strings, not PostgreSQL native ENUM types.

Rationale:

- aligns with current repo practice (`question_reports/domain/types.py`)
- avoids cross-dialect alembic complexity
- gives later Review application code a single import point

## Planned File Changes

- `docs/plan/sik-59-review-wu-r1-schema-migration.md`
- `services/api/src/sikao_api/db/enums_v2.py`
- `services/api/src/sikao_api/db/models_v2.py`
- `database/migrations/alembic/versions/1027_review_wu_r1_schema_foundation.py`
- `services/api/tests/_review_phase_r1_support.py`
- `services/api/tests/test_review_phase_r1_schema_foundation.py`
- `services/api/tests/test_review_phase_r1_schema_index_usage.py`

## Validation Plan

Primary evidence:

- `python -m pytest services/api/tests/test_review_phase_r1_schema_foundation.py -q`
  - with `TEST_POSTGRESQL_URL=postgresql+psycopg://postgres@127.0.0.1:15433/postgres`
- `python -m pytest services/api/tests/test_review_phase_r1_schema_index_usage.py -q`
  - with `TEST_POSTGRESQL_URL=postgresql+psycopg://postgres@127.0.0.1:15433/postgres`

Secondary guards:

- `python -m pytest services/api/tests/test_alembic_single_head.py -q`
- `python -m pytest services/api/tests/test_phase1_backend_infra_v2.py -q -k "phase1_alembic_cli_check_has_no_phase1_v2_drift_after_head or phase1_compare_metadata_has_no_phase1_v2_drift_after_head"`
- `python -m ruff check services/api/src/sikao_api/db/enums_v2.py services/api/src/sikao_api/db/models_v2.py services/api/tests/_review_phase_r1_support.py services/api/tests/test_review_phase_r1_schema_foundation.py services/api/tests/test_review_phase_r1_schema_index_usage.py database/migrations/alembic/versions/1027_review_wu_r1_schema_foundation.py`
- `python -m mypy services/api/src/sikao_api/db/enums_v2.py services/api/src/sikao_api/db/models_v2.py services/api/tests/_review_phase_r1_support.py services/api/tests/test_review_phase_r1_schema_foundation.py services/api/tests/test_review_phase_r1_schema_index_usage.py`

Notes:

- SQLite-only migration tests in the repo may still be run as additional drift guards, but they are not the main acceptance evidence for this issue
- independent subagent review is mandatory before `SIK-59` can be marked done
