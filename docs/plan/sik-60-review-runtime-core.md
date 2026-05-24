# SIK-60 Review Runtime Core

## Context

- Issue: `SIK-60`
- Phase: `Review`
- Milestone: `M2`
- Slice set: `WU-R2 + WU-R3 + WU-R4 + WU-R6`
- Goal: land the first usable Review runtime loop on top of `SIK-59` schema foundation.

## Requirement Source

- `docs/vault/05-migration/Phase/Review/03-Backend-WU.md` sections `WU-R2`, `WU-R3`, `WU-R4`, `WU-R6`
- `docs/vault/05-migration/Phase/Review/05-SRS-Engine.md`
- `docs/vault/05-migration/Phase/Review/06-AI-Cause-Analysis.md`
- `docs/vault/05-migration/Phase/Review/01-Boundary-Rules.md`
- current repo runtime contract after Practice `B23.4` submit-hook refactor

## Reality Check

The current repo differs from the issue body in several important ways.

### 1. Review routes are skeleton-only

Current mounted review endpoints are only:

- `GET /api/v2/review/items`
- `GET /api/v2/review/smart`
- `GET /api/v2/review/items/{item_id}`
- `POST /api/v2/review/items/{item_id}/redo`

The implementation in:

- `services/api/src/sikao_api/modules/review/interface/routes.py`
- `services/api/src/sikao_api/modules/review/application/service.py`

is placeholder-level:

- list only returns `pending`
- detail returns placeholders when no rows exist
- redo always returns `{"ok": false, "status": "unavailable"}`
- hrefs still point to legacy `/wrong-book/*`

### 2. Submit hook entrypoint drift

The issue body still says:

- add one line inside `modules/practice/application/session_service.py`

but the real post-submit entrypoint is now:

- `services/api/src/sikao_api/modules/session/interface/routes.py`
- `services/api/src/sikao_api/modules/session/application/hooks.py`

Current runtime contract after Practice `B23.4` is:

- `SessionServiceV2.submit()` finishes the state transition
- route commits the outer transaction first
- then `on_session_submit()` runs isolated follow-up hooks
- hook failure must not roll back an already-submitted session

So WU-R4 must extend the current post-commit hook rail, not resurrect the stale same-transaction path from the issue summary.

### 3. SRS docs are ahead of the issue summary

`SIK-60` summary still says “4 档 + graduated + version + algorithm_version”, but accepted Review docs already lock in:

- `probationary` intermediate status
- confidence-aware transitions
- `version` optimistic locking as a core invariant
- `algorithm_version` stored in `metadata_json`

M2 should therefore implement the accepted current SRS contract, not the older reduced wording from the issue summary.

### 4. Session answer API has no confidence / recall fields yet

Current write contract:

- `PracticeAnswerPayloadV2` only has `question_key`, `answer`, `duration_seconds`

There is no route-level payload yet for:

- `confidence`
- `used_recall`

Decision:

- `srs_engine` will accept these parameters
- current runtime callers in `SIK-60` pass `confidence=None`, `used_recall=False`
- confidence UI / transport remains a later slice, but engine semantics are implemented now

### 5. Existing flagged review writer is contract-drifted

`services/api/src/sikao_api/modules/question_flags/application/review_sync.py` currently:

- uses `source_kind="question_flag"`
- uses `reason="flagged_persistent"` as the real semantic discriminator
- mutates `source_kind` on existing rows
- coexists with lifecycle writers that settle rows into `removed` / `resolved`

This conflicts with accepted Review rules:

- `source_kind=flagged_persistent`
- `source_kind` immutable after create
- canonical runtime statuses are `pending / in_progress / probationary / graduated / archived`

M2 must normalize this writer while landing CRUD, otherwise list/filter/state-machine work will sit on the wrong source semantics.

### 6. LLM prompt layout is already standardized

Current prompt/parser home is:

- prompts: `services/api/src/sikao_api/modules/llm/application/llm/prompts/*.py`
- parsers: `services/api/src/sikao_api/modules/llm/application/parsers/*.py`

Current parser pattern is:

- `parse_with_recovery(raw)` + Pydantic validation

So WU-R6 should follow this structure, not invent a new prompt package.

### 7. `wrong_answer` auto-queue is missing

Current active v2 runtime has no automatic `wrong_answer` enqueue path:

- `SessionServiceV2.save_answers()` persists answer payloads but does not create `ReviewItemV2`
- `SessionServiceV2.submit()` finalizes the session but does not enqueue wrong answers
- the only live ReviewItem writer today is the flagged-persistent sync path

This is a core runtime gap, not a side note. If M2 only lands CRUD + `re_failed`, Review still would not receive the normal wrong-answer feed it needs to become usable.

## Scope

In scope:

- make review CRUD usable for existing backend clients
- implement the core SRS engine as pure application logic
- add or repair the base `wrong_answer` queue writer so Review is not fed only by flags / re_failed
- hook `re_failed` creation into the real post-submit rail
- add cause-analysis prompt builders + parser only
- align existing flagged-persistent writer semantics to the accepted Review source contract
- add tests for CRUD, SRS, hook, and prompt/parser

Out of scope:

- cause-analysis endpoints and cache persistence orchestration (`M3`)
- debt, taxonomy, weekly summary, insights
- frontend route migration or visual work

## Boundary Decisions

### 1. CRUD surface to land in M2

`services/api/src/sikao_api/modules/review/interface/routes.py` will expose:

- `GET /api/v2/review/items`
- `GET /api/v2/review/items/{item_id}`
- `POST /api/v2/review/items`
- `PATCH /api/v2/review/items/{item_id}/graduate`
- `PATCH /api/v2/review/items/{item_id}/archive`
- `PATCH /api/v2/review/items/{item_id}/restore`
- `POST /api/v2/review/items/batch`

`POST /api/v2/review/items/{item_id}/redo` remains mounted, but still only needs to return an explicit non-ready ack in this issue unless a real review-session builder becomes necessary to satisfy current tests. The core acceptance for M2 is CRUD + SRS + hook + prompts, not session creation UX.

### 1.1 Existing backend consumers must be kept coherent

M2 cannot update only direct review routes while leaving active consumers on the old `pending`-only and `/wrong-book/*` semantics.

Consumers already in scope:

- `services/api/src/sikao_api/modules/review/application/service.py`
  - `build_smart_review()`
  - review href generation
- `services/api/src/sikao_api/modules/planning/application/service.py`
  - dashboard review block
- active tests covering those surfaces, especially `services/api/tests/test_phase1_backend_dashboard_review_record_v2.py`

Decision:

- if `in_progress / probationary` become active states in M2, Home/dashboard review queries must explicitly decide whether they are visible active work
- `GET /api/v2/review/smart` must move with the same state semantics as list/detail
- hrefs must stop pointing at legacy `/wrong-book/*` once the route contract becomes non-placeholder

### 1.2 `reason` compatibility policy

`review_items_v2.reason` is not dead yet. Current Practice code and tests still read it as a compatibility field.

Decision for M2:

- `source_kind` becomes the only canonical runtime source discriminator
- `reason` stays as a compatibility mirror where an old consumer still expects it
- M2 writers must dual-write `reason` only for legacy-compatible cases:
  - `wrong_answer`
  - `manual_add`
  - `flagged_persistent`
  - future `low_confidence` if that writer is reintroduced
- `re_failed` and `note_card` must not invent fake legacy semantics in `reason`; use canonical `source_kind` + metadata only

This keeps Practice compatibility alive without letting `reason` remain the source of truth.

### 1.3 Historical drift policy for existing rows

M2 will not add a separate schema/data migration just to repair old Review rows, but it must define how runtime code treats already-drifted data.

Decision:

- legacy `source_kind="question_flag"` is read as the same semantic bucket as canonical `flagged_persistent`
- legacy terminal statuses `resolved` / `removed` are treated as archived-equivalent in read paths and must not appear in active Review queues
- any M2 write path that touches a legacy flagged row must normalize it in-place:
  - `source_kind -> flagged_persistent`
  - `reason -> flagged_persistent`
  - `status resolved/removed -> archived`
  - preserve the original legacy values in `metadata_json` if needed for audit/debug

This means M2 has both:

- read compatibility for untouched historical rows
- write-time normalization for rows it actively touches

### 1.4 Review attempt write contract

M2 also needs the real runtime write path that consumes the SRS engine:

- `POST /api/v2/review/items/{item_id}/attempt`

Request body in M2:

- `is_correct: bool`
- `user_answer: string`
- `confidence: "guess" | "unsure" | "likely" | "certain" | null`
- `recall_text: string | null`

Response in M2:

- reuse `ReviewDetailResponseV2`

Rationale:

- the caller needs the updated item state, new history events, action set, and metadata in one round-trip
- returning only an ack would force an immediate second fetch and create another drift-prone contract

Runtime routing rule:

- `pending` / `in_progress` => `advance_on_correct()` or `regress_on_incorrect()`
- `probationary` => `execute_probation_check()`
- `graduated` / `archived` => fail-fast `409`

Probation guard:

- a `probationary` row is attemptable only when it is actually due
- the due check is SRS-only, not debt-aware
- `next_review_at is null` or `next_review_at > today_end_local` => fail-fast `409`

Forced confidence gate:

- `confidence_mismatch_count >= 1` or `is_hard=true` => `confidence` becomes required
- backend must reject `confidence=null` for those rows even if a non-browser client bypasses UI

Attempt persistence rule:

- the route records the SRS event(s) emitted by the engine
- each recorded event must also carry the request context needed by later M3 cause-analysis:
  - `userAnswer`
  - `isCorrect`
  - `submittedConfidence`
  - `effectiveConfidence`
  - `usedRecall`
  - `recallText` when present
- M2 does not add a second synthetic `ATTEMPTED` event just to mirror the same payload

Probation failure rule:

- failed `execute_probation_check()` creates a new `re_failed` row immediately inside the same transaction
- the original `probationary` row stays `probationary` with `next_review_at = null`
- the new row uses canonical `source_kind = re_failed`
- `source_id` points to the original review item id, not an invented session id

M2 metadata side effects for any review attempt:

- `last_answer_hash`
- `used_recall`
- `confidence_skipped_count` when `confidence=null`
- `last_reviewed_at`
- `last_confidence` as the effective confidence (`null -> likely`)
- `confidence_prompted_forced` / `confidence_skipped` flags stay in attempt notes

### 2. Canonical active statuses in M2

Use accepted Review states:

- `pending`
- `in_progress`
- `probationary`
- `graduated`
- `archived`

Active set in M2:

- `pending`
- `in_progress`
- `probationary`

### 3. Manual graduate semantics

`PATCH /items/{id}/graduate` will move:

- `pending` or `in_progress`
- to `probationary`

not directly to `graduated`.

Rationale:

- accepted SRS docs already define manual resolve as “jump to probationary”
- direct `graduated` would reintroduce contract drift one slice after `SIK-59`

### 4. SRS write model

Top-level mutable SRS columns in M2:

- `status`
- `correct_streak`
- `next_review_at`
- `version`

Metadata keys written in M2:

- `algorithm_version`
- `last_reviewed_at`
- `last_confidence`
- `unsure_blocked_graduation`
- `probation_started_at`
- `probation_check_at`
- `probation_attempts`
- `graduated_at`
- `early_graduated`
- `confidence_mismatch_count`
- `forced_cause_analysis_pending`
- `forced_reason`
- `is_hard`
- `hard_marked_at`
- `last_answer_hash`
- `used_recall`
- `confidence_skipped_count`
- `original_review_item_id`
- `from_probation_check`
- `probation_failed_at`

### 5. Optimistic lock policy

M2 will not introduce a generic repository abstraction just for CAS.

Instead:

- `srs_engine` returns the intended post-state
- writer paths perform `UPDATE ... WHERE id=:id AND version=:expected`
- rowcount `!= 1` raises fail-fast domain error

This keeps the invariant real without inventing extra infrastructure.

### 6. Hook insertion point

WU-R4 will extend:

- `modules/session/application/hooks.py`

not `SessionServiceV2.submit()` and not the old nonexistent `practice/application/session_service.py`.

Execution order:

1. outer session submit commits
2. `on_session_submit()` invokes existing progress hooks
3. same post-commit rail invokes new Review submit hook

Consequences:

- submitted session durability wins over review follow-up failure
- Review hook must be idempotent
- Review hook failures are logged / raised in isolated session scope, not allowed to undo submit

### 7. Wrong answer detection source

The Review submit hook will read:

- `PracticeSessionAnswerV2.is_correct`

as the authoritative correctness signal.

This means M2 also has to confirm or repair the current submit-time correctness persistence path if needed before relying on the hook. If current write paths leave `is_correct` unset for live reviewable sessions, that is a blocker to fix inside `SIK-60`, not something to defer.

### 7.1 Review queue writers in M2

M2 must treat these as distinct but convergent writers:

- base writer: ordinary wrong answers from session submit
- flagged writer: persistent flag promotion
- `re_failed` writer: graduated/probationary item fails again
- manual writer: `POST /api/v2/review/items`

All of them must converge on the same canonical `source_kind`, status set, and metadata conventions.

### 8. Prompt/parser deliverables

Add:

- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_single.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_group.py`
- `services/api/src/sikao_api/modules/llm/application/parsers/cause_analysis_parser.py`

Parser contract:

- valid JSON => typed object
- invalid JSON => fail-fast typed parse error, not silent fallback payload

M3 can decide endpoint-level 503 handling around it.

## Planned File Changes

- `docs/plan/sik-60-review-runtime-core.md`
- `services/api/src/sikao_api/modules/review/interface/routes.py`
- `services/api/src/sikao_api/modules/review/application/service.py`
- `services/api/src/sikao_api/modules/review/application/validators.py`
- `services/api/src/sikao_api/modules/review/application/srs_constants.py`
- `services/api/src/sikao_api/modules/review/application/srs_engine.py`
- `services/api/src/sikao_api/modules/review/application/hooks.py`
- `services/api/src/sikao_api/modules/session/application/hooks.py`
- `services/api/src/sikao_api/modules/session/application/service.py`
- `services/api/src/sikao_api/modules/question_flags/application/review_sync.py`
- `services/api/src/sikao_api/modules/question_flags/application/lifecycle.py`
- `services/api/src/sikao_api/modules/planning/application/service.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_single.py`
- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_group.py`
- `services/api/src/sikao_api/modules/llm/application/parsers/cause_analysis_parser.py`
- `services/api/src/sikao_api/db/schemas_v2.py`
- review / session / llm targeted tests

## Validation Plan

Primary runtime evidence:

- review CRUD targeted tests
- SRS engine 12-scenario unit tests
- base `wrong_answer` queue writer integration tests
- submit-hook PG integration tests
- prompt render + parser tests

Scoped validation target:

- `ruff` on changed files
- `mypy` on changed review/session/llm files
- PostgreSQL-first targeted pytest for hook/runtime cases
- pure unit pytest for SRS engine and parser cases

Closeout note:

- checked-in `services/api/spec/openapi.json` may require a user-approved H9 generated-artifact exception because it is a single deterministic export file
- if that exception is used, it must be called out in both the final Multica Evidence Block and the delivery summary

Explicit non-goal for validation wording:

- if only targeted suites are run, final evidence must say scoped validation passed
- do not claim full backend pytest for this issue unless it is actually rerun
