# SIK-25 Practice B30.1 Question Report
## Context
- Issue: `SIK-25`
- Phase: `Practice`
- Slice: `B30.1`
- Goal: land the user-facing `question_report` foundation before `B30.2` admin handling and `B24` final gate.

## Requirement Source

- `docs/vault/05-migration/Phase/Practice/03-Backend-WU.md` section `24.1` / `24.2 B30.1`
- `docs/vault/05-migration/Phase/Practice/01-Boundary-Rules.md` section `17`
- `docs/vault/05-migration/Phase/Practice/02-Data-Model.md` section `3.12` and `5.8` / `5.9`
- `docs/vault/05-migration/Phase/Practice/10-Testing.md` section `3.10`
## Scope

User-facing only in this slice:

- `POST /api/v2/practice/questions/{qid}/reports`
- `GET /api/v2/practice/questions/{qid}/reports`
- `PATCH /api/v2/practice/reports/{rid}`
- `DELETE /api/v2/practice/reports/{rid}`

Out of scope for this slice:

- admin list/update/apply-fix endpoints
- `ai_cleanup_cron` aggregation hook
- report-driven auto deactivate behavior
## Stable Boundary

### Data Model

Add `QuestionReportV2` with:

- `id`
- `user_id -> users_v2.id`
- `question_id -> questions_v2.id`
- `category`
- `description`
- `status`
- `handled_by_admin_id -> users_v2.id`, nullable
- `handled_at`, nullable
- `admin_response`, nullable
- `duplicate_of_report_id -> question_report_v2.id`, nullable
- `applied_fix`, nullable JSON
- `source_session_id -> practice_sessions_v2.id`, nullable
- `selected_answer_at_report`, nullable JSON
- `deleted_at`, nullable
- `created_at`
- `updated_at`

### Allowed enums

- `QuestionReportCategory`: `stem_typo | option_missing | answer_disputed | explanation_wrong | formatting | other`
- `QuestionReportStatus`: `pending | acknowledged | resolved_fixed | resolved_invalid | resolved_duplicate`

### User-side business rules

- New report starts as `pending`.
- User can only read their own reports.
- User can update only `pending` reports, and only `description`.
- User can delete only `pending` reports; deletion is soft delete via `deleted_at`.
- Duplicate active report for same `(user_id, question_id, category)` must return `409 REPORT_DUPLICATE_PENDING`.

### DB constraints that must exist in B30.1

- description length: `10..1000`
- resolved status requires `handled_by_admin_id + handled_at + admin_response`
- `applied_fix` iff `status=resolved_fixed`
- `duplicate_of_report_id` iff `status=resolved_duplicate`
- terminal immutable trigger for `resolved_*`
- partial unique index on `(user_id, question_id, category)` where:
  - `status in ('pending', 'acknowledged')`
  - `deleted_at IS NULL`
## API Contract

### Create request

- `category`
- `description`
- `sourceSessionId?`
- `selectedAnswerAtReport?`

### Response envelope

- `id`
- `questionId`
- `category`
- `description`
- `status`
- `adminResponse`
- `duplicateOfReportId`
- `appliedFix`
- `sourceSessionId`
- `selectedAnswerAtReport`
- `createdAt`
- `updatedAt`
- `handledAt`

### Error contract

- `409 REPORT_DUPLICATE_PENDING`
- `404 question_report_not_found` for cross-user access
- `422` for validation failures
## Implementation Plan

1. Add plan-aligned ORM + Pydantic schemas + module type/error definitions.
2. Add Alembic migration for table, checks, partial unique index, and terminal trigger.
3. Implement user-side service methods:
   - `create_report`
   - `list_user_reports`
   - `update_pending`
   - `soft_delete_pending`
4. Wire practice router in `main.py`.
5. Add tests for:
   - active duplicate guard
   - description length
   - owner-only read/update/delete
   - pending-only mutation semantics
   - PostgreSQL migration-level invariants
## Validation Plan

- `ruff check`
- `mypy`
- targeted Python tests
- targeted PostgreSQL tests with `TEST_POSTGRESQL_URL`
- independent subagent review before claiming slice complete
