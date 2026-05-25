---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-48
---

# SIK-48 Notes Tags Image Export Contract

## Goal

Implement `WU-N2 + WU-N4 + WU-N7` on top of the `SIK-47` Notes CRUD base:

- tags CRUD
- image upload metadata + orphan-ready persistence
- markdown/html export

without pulling in Meilisearch, LLM, community, or final OpenAPI lock scope.

## Current Reality

### 1. Runtime owner remains `modules/notes_v2`

`/api/v2/notes` is still owned by `modules/notes_v2`, and `SIK-48` continues that path.

No runtime work will be revived under:

- legacy `modules/notes/interface/routes.py`
- legacy `modules/notes/interface/notebook.py`

### 2. `NoteTagV2` and `NoteImageV2` now exist, but no public APIs do

After `SIK-47`:

- `NoteTagV2` exists
- `NoteImageV2` exists
- `tiptap_converter.json_to_markdown/json_to_html` exist only as minimal placeholders

Missing for `SIK-48`:

- `/api/v2/notes/tags`
- `/api/v2/notes/{note_id}/tags`
- `/api/v2/notes/tags/rename`
- `/api/v2/notes/tags/merge`
- `/api/v2/notes/images`
- `/api/v2/notes/{note_id}/export`

### 3. `NoteImageV2.note_id` is currently non-nullable

That conflicts with the accepted image-upload contract:

- upload may happen before note save
- orphan cleanup is based on `note_id IS NULL`

So `SIK-48` must explicitly relax that column to nullable.

### 4. Pillow is required by the accepted contract but is missing locally

The accepted Notes backend spec requires Pillow-based image metadata extraction.

Current local reality:

- `PIL` import fails in `.venv`
- `services/api/pyproject.toml` does not declare Pillow yet

## Contract Decisions

### D1. Route ownership and split

All `SIK-48` endpoints live under `modules/notes_v2/interface/routes.py`.

We do not create separate router files in this milestone because:

- the active runtime is already centralized there
- the total route count is still small
- deferring route splitting avoids mixing `SIK-48` with a pure architecture refactor

### D2. Tags contract

Endpoints:

- `GET /api/v2/notes/tags`
- `POST /api/v2/notes/{note_id}/tags`
- `DELETE /api/v2/notes/{note_id}/tags/{tag_name}`
- `PATCH /api/v2/notes/tags/rename`
- `POST /api/v2/notes/tags/merge`

Rules:

- tag names normalize to `strip().lower()`
- add is idempotent if `(note_id, tag_name)` already exists
- max 10 tags per note
- `is_system=true` tags cannot be renamed, merged, or removed by users
- `list_tags` is scoped to current user and ordered by `usage_count DESC, tag_name ASC`
- merge de-duplicates per note

### D3. Image upload contract

Endpoint:

- `POST /api/v2/notes/images`

Request:

- multipart form
- `image`
- optional `note_id`

Response shape:

- `id`
- `url`
- `file_name`
- `file_size`
- `mime_type`
- `width`
- `height`

Rules:

- path: `/uploads/notes/{user_id}/{uuid}.{ext}`
- max size: `5MB`
- allowed MIME:
  - `image/png`
  - `image/jpeg`
  - `image/gif`
  - `image/webp`
- if `note_id` is provided:
  - note must exist
  - note must belong to current user
  - current note image count must stay `<= 20`
- if `note_id` is omitted:
  - row is persisted with `note_id = NULL`
  - this is the orphan-cleanup input for `M6`

### D4. `NoteImageV2` schema change

`note_images_v2.note_id` becomes nullable in `SIK-48`.

This is not optional; otherwise the accepted orphan-cleanup contract is fake.

No orphan cleanup job is registered in this issue.

Only the persistence shape is prepared.

### D5. Export contract

Endpoint:

- `GET /api/v2/notes/{note_id}/export?format=markdown|html`

`format=markdown`:

- `text/markdown; charset=utf-8`
- YAML frontmatter includes:
  - `title`
  - `tags`
  - `created_at`
- body uses `json_to_markdown`
- if `body_json is NULL`, fallback to legacy `body`

`format=html`:

- `text/html; charset=utf-8`
- complete document, not fragment-only
- if `body_json is NULL`, fallback to escaped legacy `body`

### D6. Error code mapping

`SIK-48` will use these explicit codes:

- `tag_limit_exceeded`
- `image_too_large`
- `image_invalid_type`
- `image_limit_exceeded`
- `note_not_found`
- `forbidden`
- `validation_error`

No new error base class is introduced in this issue.

### D7. Dependency decision

Add Pillow as an explicit backend dependency for the API service and install it locally.

Reason:

- it is required by the accepted Notes image metadata contract
- local env currently lacks `PIL`
- user explicitly allowed installing missing environment pieces

## Out of Scope

- Meilisearch sync/search
- weekly review
- ai summary
- community visibility/feed
- OpenAPI checked-in artifact lock
- generated TypeScript client lock
- orphan cleanup scheduler registration

OpenAPI live schema will naturally include the new routes once registered, but checked-in lockfiles remain owned by `SIK-52`.

## Validation Contract

Before `SIK-48` can be marked done:

- independent subagent review must cover:
  - tag rename/merge semantics
  - image path traversal and file validation
  - nullable orphan image persistence decision
- validation must include:
  - targeted Postgres tests for tags/image/export
  - fresh `alembic upgrade head`
  - fresh `alembic downgrade -1`
  - targeted `ruff`
  - targeted `mypy`
  - route smoke through the active app
