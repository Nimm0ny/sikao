# SIK-61 Review Cause Analysis + Taxonomy

## Context

- Issue: `SIK-61`
- Phase: `Review`
- Milestone: `M3`
- Slice set: `WU-R5 + WU-R13`
- Goal: land the first usable cause-analysis runtime on top of `SIK-60`.

## Requirement Source

- `docs/vault/05-migration/Phase/Review/03-Backend-WU.md` sections `WU-R5`, `WU-R13`
- `docs/vault/05-migration/Phase/Review/06-AI-Cause-Analysis.md`
- `docs/vault/05-migration/Phase/Review/13-Cause-Taxonomy.md`
- `docs/vault/05-migration/Phase/Review/01-Boundary-Rules.md`
- current repo runtime after `SIK-60`

## Reality Check

### 1. `AiCauseAnalysisV2` exists, but cause-analysis runtime does not

Current schema already has:

- `AiCauseAnalysisV2`
- cache-oriented indexes
- `CauseAnalysisScope`

but there is still no live Review runtime for:

- `POST /api/v2/review/items/{item_id}/cause-analysis`
- `POST /api/v2/review/cause-analysis/group`
- override / invalidate-cache / cause-tag list endpoints

So `SIK-61` is not a refinement pass. It is the first real runtime implementation.

### 2. The issue body's migration reference is stale

The issue still says:

- `0033_review_seed_cause_tags.py`

but the real repo migration head is:

- `1027_review_wu_r1_schema_foundation.py`

Decision:

- `SIK-61` must use a new `1028_*` migration series
- do not invent a legacy `0033` path

### 3. `AiCauseAnalysisV2` currently has no `version` column

The accepted taxonomy docs say override should:

- audit the change
- bump analysis version

Current `AiCauseAnalysisV2` only has:

- `id`
- `user_id`
- `scope`
- target columns
- `input_hash`
- `result_json`
- `llm_call_id`
- `created_at`
- `expires_at`

Decision:

- `SIK-61` will add top-level `version` and `updated_at` to `AiCauseAnalysisV2`
- override writes must use optimistic locking semantics on that row, not a fake `result_json` counter

### 4. Current prompt/parser artifacts are only a thin WU-R6 skeleton

Already present:

- `cause_analysis_single.py`
- `cause_analysis_group.py`
- `cause_analysis_parser.py`

Current gaps:

- slug allowlist comes from static `CAUSE_TAGS`, not DB-backed taxonomy
- there is no process cache invalidate path
- no user override shape
- no degraded-response warning logic
- no forced/deep prompt variant

Decision:

- keep the existing files, but upgrade them to the accepted taxonomy contract
- add `cause_analysis_forced.py`
- do **not** add `cause_analysis_deep.py` in `SIK-61`; deep analysis belongs with hard/debt runtime in `SIK-63`

### 5. `forced` mode is already a real backend need; `deep` is not

After `SIK-60`, Review attempt runtime now writes:

- `metadata.forced_cause_analysis_pending`
- `metadata.forced_reason`

So `forced` cause-analysis is already an active backend contract.

By contrast, `deep` depends on hard/debt orchestration from later Review slices and is not yet reachable through a stable runtime path.

Decision:

- `SIK-61` supports:
  - `single`
  - `forced`
  - `group`
- `deep` remains explicitly deferred to `SIK-63`

### 6. Repo LLM primitives already define the correct execution pattern

Available reusable building blocks:

- `call_json_completion()`
- `record_success_call()` / `persist_failed_call()`
- `HomeLlmQuotaService`
- `llm.application.idempotency`

Decision:

- `SIK-61` reuses these primitives
- fail-fast parse/LLM errors remain `503` at the route boundary
- no new custom quota or idempotency framework will be introduced

### 7. Admin auth in this repo is basic-admin, not `UserV2.is_super_user`

The accepted docs say:

- invalidate-cache is super-user only

Repo reality:

- admin-only routes currently use `get_admin_principal`
- there is no live `UserV2.is_super_user` runtime gate

Decision:

- `POST /api/v2/admin/review/cause-tags/invalidate-cache` will use `get_admin_principal`
- this is the repo's effective "super_user" contract for now

## Scope

In scope:

- single + forced cause-analysis runtime
- group cause-analysis runtime
- DB-backed taxonomy table + seed
- parser taxonomy fallback and TTL cache
- user override endpoint
- admin invalidate-cache endpoint
- cause-tag list endpoint
- `AiCauseAnalysisV2` optimistic-lock-ready schema extension
- PostgreSQL-first tests for runtime, cache, override, and taxonomy invariants

Out of scope:

- weekly review / insights / debt / recommendation bridge
- deep hard-question analysis mode and its scheduler path
- frontend UI and browser work
- note save / feedback endpoints from later Review slices

## Boundary Decisions

### 1. Endpoints to land in `SIK-61`

`services/api/src/sikao_api/modules/review/interface/routes.py` will add:

- `POST /api/v2/review/items/{item_id}/cause-analysis`
- `POST /api/v2/review/cause-analysis/group`
- `PATCH /api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}`
- `GET /api/v2/review/cause-tags`
- `POST /api/v2/admin/review/cause-tags/invalidate-cache`

### 2. Single-analysis request contract

Route:

- `POST /api/v2/review/items/{item_id}/cause-analysis`

Headers:

- `Idempotency-Key` required

Body:

- `mode: "single" | "forced"` default `single`

Rules:

- `single` consumes normal Review cause-analysis quota
- `forced` bypasses per-purpose quota but still records `LlmCallV2`
- `forced` is only valid when the source item has `metadata.forced_cause_analysis_pending = true`
- `forced` success clears `forced_cause_analysis_pending`
- `forced` failure does not mutate that flag and does not block the caller from reading Review detail

### 3. Group-analysis request contract

Route:

- `POST /api/v2/review/cause-analysis/group`

Headers:

- `Idempotency-Key` required

Body:

- `item_ids: list[int]`

Rules:

- min 2, max 20
- `item_ids` must be distinct
- all items must belong to the current user
- only active Review items are eligible
- service canonicalizes the group to a stable order before prompt/hash construction
- group cache uses:
  - stable `question_ids_signature = sorted(question_ids)`
  - real `input_hash` that includes each item's latest answer-state summary

### 4. Response contract

Single and group endpoints return a shared envelope:

- `analysisId`
- `scope`
- `mode`
- `cached`
- `expiresAt`
- `llmCallId`
- `warningCode | null`
- `result`

`result` contains:

- `summary`
- `dimensions`
- `suggestedActions`
- `relatedQuestions`
- `evolutionContext | null`
- `_meta`

### 5. `AiCauseAnalysisV2` schema extension

`SIK-61` migration will:

- add `version` integer not null default `1`
- add `updated_at` timestamp not null default `created_at`
- create `cause_tag_v2`

It will not:

- add a separate `analysis_events` table

### 6. Taxonomy storage contract

`CauseTagV2` columns:

- `slug`
- `name`
- `category`
- `severity_default`
- `description`
- `display_order`
- `is_active`
- `taxonomy_version`
- `created_at`
- `updated_at`

Seed:

- 16 active rows (`15 + other`)
- `taxonomy_version = 'v1'`

### 7. Parser contract

Parser must:

- load active slugs from `cause_tag_v2`
- keep a 5-minute in-process cache
- support explicit invalidation through admin endpoint
- normalize slug case
- fallback unknown / inactive / deprecated slug to `other`
- preserve the raw LLM dimension in `_llm_original`
- clamp invalid severity to `medium`

Degraded-response rule:

- `>= 3` fallback-to-`other` dimensions => response returns `warningCode = "taxonomy_degraded_response"`

### 8. Override contract

Route:

- `PATCH /api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}`

Body:

- `slug`
- `userSeverity | null`
- `userNote | null`
- `expectedVersion`

Rules:

- only `scope=single` analyses are mutable through this endpoint
- `scope=group` override is explicitly out of scope for `SIK-61`
- owner-only
- target slug must be active and valid
- preserve LLM original slug in `_llm_original_slug`
- write `user_override` block
- effective slug for the returned payload becomes the override slug
- optimistic lock failure => `409`
- write `ReviewAttemptV2(outcome=cause_tag_overridden)`

### 9. Cache semantics

Single cache key includes:

- `user_id`
- `question_id`
- `last_answer_hash`
- current effective confidence
- current error-count summary
- `mode`

Group cache key includes:

- `user_id`
- `question_ids_signature`
- `input_hash`
- literal `group`

The group `input_hash` must change when any member item changes in ways that alter
the analysis prompt, including at least:

- latest `last_answer_hash`
- latest effective confidence
- latest correctness signal
- latest error count summary

TTL:

- use `settings.llm_cache_ttl_seconds`

### 10. Evolution-context rule

For `single` mode:

- first try to reuse the latest non-expired single/forced analysis whose stored
  prompt-shaping state still matches the current answer state
- only when no such row exists, load the latest prior single/forced analysis for
  the same user + question
- include it in the prompt context
- do not invalidate cache merely because the cached row itself became the latest analysis

For `forced` mode:

- do not inject previous analysis by default
- the point is immediate mismatch diagnosis, not longitudinal comparison

### 11. Quota mapping

Use `HomeLlmQuotaService`, with a new per-purpose bucket:

- `review_cause_analysis`

Policy:

- `single` and `group` consume `review_cause_analysis`
- `forced` is fully quota-exempt in `SIK-61`
- `forced` still records `LlmCallV2`, but no `429` must be emitted from quota gates for that mode

### 12. Error policy

- provider / parse / schema failures => `LLMServiceError` surface as `503`
- quota => `429`
- idempotency in progress => `409`
- invalid override slug => `422`
- wrong owner => `404`
- invalid forced mode usage => `409`

## Planned File Changes

- `docs/plan/sik-61-review-cause-analysis-taxonomy.md`
- `database/migrations/alembic/versions/1028_review_cause_analysis_taxonomy.py`
- `services/api/src/sikao_api/db/models_v2.py`
- `services/api/src/sikao_api/db/enums_v2.py`
- `services/api/src/sikao_api/db/schemas_v2.py`
- `services/api/src/sikao_api/modules/review/interface/routes.py`
- `services/api/src/sikao_api/modules/review/application/cause_analysis_service.py`
- `services/api/src/sikao_api/modules/review/application/cause_analysis_cache.py`
- `services/api/src/sikao_api/modules/review/application/cause_override_service.py`
- `services/api/src/sikao_api/modules/review/application/effective_slug.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_single.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_group.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_forced.py`
- `services/api/src/sikao_api/modules/llm/application/parsers/cause_analysis_parser.py`
- PostgreSQL-first Review + taxonomy tests

## Validation Plan

Primary evidence:

- taxonomy migration + seed proof
- single cause-analysis cache hit/miss proof
- forced mode contract proof
- override optimistic-lock + audit proof
- invalidate-cache proof
- parser fallback / degraded-response proof

Scoped validation target:

- `ruff` on changed files
- `mypy` on changed review/llm/db files
- PostgreSQL targeted pytest for migration/runtime/override/cache
- prompt/parser unit tests
- OpenAPI spec regeneration + generated client regeneration
- `python -m pytest services/api/tests/test_home_phase_m6_contract_lock.py -q`

Explicit closeout rule:

- this issue cannot be marked done without an independent subagent review
- if OpenAPI or generated client artifacts drift, regenerate and commit them as part of the issue evidence
