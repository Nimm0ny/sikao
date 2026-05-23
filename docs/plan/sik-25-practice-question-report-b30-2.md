# SIK-25 Practice B30.2 Question Report Admin Flow
## Context
- Issue: `SIK-25`
- Phase: `Practice`
- Slice: `B30.2`
- Goal: finish the `question_report` module by adding admin handling, question mutation, and `ai_cleanup_cron` report aggregation before the final `B24` gate.
## Requirement Source
- `docs/vault/05-migration/Phase/Practice/03-Backend-WU.md` section `24.2 B30.2`
- `docs/vault/05-migration/Phase/Practice/01-Boundary-Rules.md` section `17`
- `docs/vault/05-migration/Phase/Practice/02-Data-Model.md` section `3.12`, `5.8`, `5.9`
- `docs/vault/05-migration/Phase/Practice/09-Observability-Audit.md`
- `docs/vault/05-migration/Phase/Practice/10-Testing.md` section `3.10`
## Scope
- `GET /api/v2/admin/practice/reports`
- `PATCH /api/v2/admin/practice/reports/{rid}`
- `POST /api/v2/admin/practice/reports/{rid}/apply-fix`
- `ai_cleanup_cron` aggregation from `QuestionReportV2`
Out of scope: `B24` OpenAPI/e2e final closeout, phase-2 `question_metadata`.
## Stable Boundary
### Admin routes
- Admin auth uses existing HTTP Basic `get_admin_principal`.
- Mutating admin routes also attach `verify_csrf_token_if_cookie_auth` for consistency with existing admin routes.
### Admin actor resolution
`QuestionReportV2.handled_by_admin_id` is mandatory for resolved terminal states, but admin auth is not backed by `users_v2`.
- resolve admin principal to a deterministic shadow `UserV2`
- lookup key: synthetic email contact `__admin__.{username}@system.local`
- create on first use when absent
- this row exists only to satisfy `handled_by_admin_id` and audit referential integrity
- the `__admin__.*@system.local` namespace is reserved from normal email registration/bind flows
### Status flow
Allowed transitions: `pending -> acknowledged`, `pending -> resolved_invalid`, `pending -> resolved_duplicate`, `acknowledged -> resolved_invalid`, `acknowledged -> resolved_duplicate`. `resolved_fixed` is only reachable through `apply-fix`. Terminal rows stay immutable by DB trigger; service must still fail fast before commit.
### Duplicate resolution
`duplicate_of_report_id` is required and must point to a non-deleted report on the same `question_id`, but never to `rid` itself.
### Apply-fix contract
Endpoint: `POST /api/v2/admin/practice/reports/{rid}/apply-fix`
- Request shape: `field` in `stem | options | correct_answer | explanation`, required `adminResponse`, `textAfter` for text fields, ordered `optionsAfter` for `options`.
- `stem`
  - update `QuestionV2.prompt`
  - if `content_json.stem` exists, update it too
- `options`
  - if `QuestionOptionV2` rows exist, only allow text/order changes on the current key set
  - if `content_json.options` exists, sync that map too
  - if the submitted key set differs from the existing key set, reject
- `correct_answer`
  - if `content_json.correct_answer` exists, update it
  - else if `content_json.answerText` exists, update it
- `explanation`
  - if `content_json.explanation` exists, update it
  - else if `content_json.explanationText` exists, update it
On success: recompute `content_hash` from updated `prompt + content_json`, set `QuestionReportV2.status = resolved_fixed`, persist `applied_fix = { field, before, after }`.
### Audit contract
Every admin state change writes `question_report.status_changed`; duplicate resolution also writes `question_report.dup_marked`; apply-fix additionally writes `question_report.fix_applied` and `question.field_updated`.
### ai_cleanup aggregation
`cleanup_low_quality_ai_questions()` becomes the only place in this slice that overwrites `QuestionV2.report_count` from `QuestionReportV2`.
- aggregate active reports with `status in (pending, acknowledged)` and `deleted_at IS NULL`
- for AI questions, keep backward compatibility with legacy `ai_question.feedback.report` by using:
  - `report_count = max(active_question_reports, legacy_ai_feedback_reports)`
- sync `QuestionV2.report_count` for AI questions and for real-exam questions with active reports or stale `report_count > 0`
- AI questions keep the current quality formula, recompute with aggregated report count, and auto deactivate when `report_count >= 5`
- real-exam questions only update `report_count`; they never auto deactivate
## API Contract
### Admin list response
Each item includes the report envelope plus `reporterUserId`, `reporterDisplayName`, `questionPrompt`, `questionSource`, `questionIsActive`, and `activeReportCount`.
List response includes `items`, `total`, `pendingCount`, `page`, and `pageSize`.
Filters: `status?`, `category?`, `question_id?`, `limit`, `offset`.
Default ordering: `activeReportCount DESC`, `createdAt ASC`, `id ASC`.
## Validation Plan
- `ruff check`
- `mypy`
- targeted user/admin/cron tests
- PostgreSQL tests with `TEST_POSTGRESQL_URL`
- independent subagent review before claiming slice complete
