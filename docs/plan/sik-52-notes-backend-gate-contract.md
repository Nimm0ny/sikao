---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-26
source: multica
multica-issue: SIK-52
---

# SIK-52 Notes Backend Final Gate Contract

## Goal

Close Notes backend M6 by proving the Notes runtime is production-shaped across:

- cron registration
- mutation audit coverage
- checked-in OpenAPI lock
- backend request-level end-to-end coverage

## Current Reality

1. `SIK-48` through `SIK-51` have landed the runtime feature set, but Notes still lacks its own final backend gate issue artifacts.
2. The checked-in backend OpenAPI SSOT in this repo is `services/api/spec/openapi.json`, not `services/api/openapi.json`.
3. `scripts/generate-api-types.sh` already shells through `services/api/scripts/export_openapi.py` and writes `services/api/spec/openapi.json`, so `SIK-52` must preserve that path instead of inventing a second export target.
4. Notes currently has no registered orphan-image cleanup job in `HomeScheduler`.
5. Review already owns `review.weekly_summary.snapshot`; Notes weekly review note generation remains manual and does not currently own a separate pre-generation cron.
6. Notes mutation audit is partial:
   - search sync degrade writes audit
   - community visibility writes audit
   - generic create/update/delete, image upload, weekly generation, and AI summary confirm still need explicit gate review

## Contract Decisions

### D1. OpenAPI lock path

`SIK-52` treats these files as the authoritative backend contract chain:

- export entrypoint: `services/api/scripts/export_openapi.py`
- checked-in schema: `services/api/spec/openapi.json`
- optional frontend consumer snapshot: `packages/api-client/src/types/api.generated.ts`

No new `services/api/openapi.json` path is introduced.

### D2. Notes cron scope

`SIK-52` registers exactly one new Notes-owned recurring job:

- `notes.orphan_image_cleanup`

Behavior:

- daily at `04:00`
- scheduler timezone = existing app scheduler timezone (`Asia/Shanghai` in Stage 1)
- deletes `NoteImageV2` rows older than 24 hours where `note_id IS NULL`
- best-effort deletes physical files under `upload_dir`
- idempotent on rerun

### D3. Weekly snapshot ownership

`SIK-52` does **not** introduce a second Notes-specific weekly snapshot cron.

Reason:

- `review.weekly_summary.snapshot` already exists and owns weekly summary snapshot generation
- Notes weekly-review note generation remains a user-triggered/manual runtime from `SIK-50`
- adding a second scheduler job here would create overlapping ownership without an accepted contract

### D4. Mutation audit scope

For `SIK-52`, Notes mutation audit coverage includes:

- note create
- note update
- note soft-delete
- note visibility change
- note image upload
- AI summary confirm
- weekly review generation

Tag mutation audit is optional for this issue and may remain outside the required M6 gate unless touched incidentally.

### D5. Audit action naming

Canonical Notes audit actions:

- `notes.created`
- `notes.updated`
- `notes.soft_deleted`
- `notes.community.visibility_updated`
- `notes.image.uploaded`
- `notes.ai_summary.confirmed`
- `notes.weekly_review.generated`
- existing search degrade actions remain:
  - `notes.search.create_failed`
  - `notes.search.update_failed`
  - `notes.search.delete_failed`
  - `notes.search.community_visibility_failed`

### D6. Audit payload minimums

When applicable, Notes mutation audits must include:

- `target_type`
- `target_id`
- `before` / `after` snapshots or a narrow field-level equivalent
- request id when available
- related object ids in metadata (`noteId`, `imageId`, `reviewItemIds`, `llmCallId`)

### D7. Backend e2e gate interpretation

`SIK-52` uses PostgreSQL-backed request-level API tests as the authoritative backend end-to-end proof.

This gate does not require a separate browser-driven E2E harness.

### D8. Endpoint coverage target

The backend final gate must cover the full active Notes API surface:

- `GET /api/v2/notes`
- `POST /api/v2/notes`
- `GET /api/v2/notes/{note_id}`
- `PUT /api/v2/notes/{note_id}`
- `DELETE /api/v2/notes/{note_id}`
- `GET /api/v2/notes/tags`
- `PATCH /api/v2/notes/tags/rename`
- `POST /api/v2/notes/tags/merge`
- `POST /api/v2/notes/{note_id}/tags`
- `DELETE /api/v2/notes/{note_id}/tags/{tag_name}`
- `POST /api/v2/notes/images`
- `GET /api/v2/notes/search`
- `PATCH /api/v2/notes/{note_id}/visibility`
- `GET /api/v2/notes/community`
- `GET /api/v2/notes/{note_id}/export`
- `POST /api/v2/notes/{note_id}/ai-summary`
- `POST /api/v2/notes/{note_id}/ai-summary/confirm`
- `POST /api/v2/notes/weekly-review/generate`

### D9. Dependency confirmation

Current runtime dependencies are already sufficient for the landed Notes surface unless validation proves otherwise.

`SIK-52` only changes `services/api/pyproject.toml` if evidence shows a real missing dependency.

## Validation Contract

Before `SIK-52` can be marked done:

- independent subagent review must cover cron idempotency, audit completeness, and OpenAPI lock
- backend full validation must include:
  - `ruff`
  - `mypy`
  - targeted PostgreSQL request-level Notes suite
  - alembic upgrade head
  - OpenAPI drift check against `services/api/spec/openapi.json`
- strong evidence must exist for:
  - orphan-image cleanup rerun idempotency
  - Notes mutation audit rows
  - AI summary confirm -> `ReviewItemV2(source_kind=note_card)` hook
  - checked-in OpenAPI containing the full active Notes surface
