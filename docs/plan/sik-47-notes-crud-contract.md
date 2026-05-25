---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-47
---

# SIK-47 Notes CRUD Contract

## Goal

Implement `WU-N1` as the first real Notes backend milestone on top of the current backend rewrite:

- extend `NoteV2` to the Phase-Notes canonical schema
- add the five new Notes support tables
- replace the current `/api/v2/notes` skeleton behavior with the canonical CRUD contract
- keep later milestones (`tags/search/images/weekly/community`) unimplemented but unblocked

## Current Reality

### 1. The live `/api/v2/notes` owner is `modules/notes_v2`

- `main.py` currently registers:
  - `from sikao_api.modules.notes_v2.interface import routes as notes_v2_skeleton`
  - `app.include_router(notes_v2_skeleton.router)`
- So the active runtime owner for `/api/v2/notes` is `modules/notes_v2`.

### 2. There is an older, conflicting `/api/v2/notes/{question_id}` implementation in `modules/notes`

- `services/api/src/sikao_api/modules/notes/interface/routes.py` still defines the old question-note endpoints under `/api/v2/notes/{question_id}`.
- Those routes are not registered by `main.py`.
- They cannot coexist with the new canonical note-by-id CRUD under the same prefix without path ambiguity.

### 3. There is also an older notebook namespace under `/api/v2/notebook`

- `modules/notes/interface/notebook.py` and `modules/notes/application/notebook.py` implement the old cross-domain notebook model.
- That namespace remains present in the repo but is not the active Notes Phase runtime owner for `/api/v2/notes`.

### 4. `NoteV2` is only partially prepared

Current `models_v2.py` already has:

- `title`
- `body`
- `status`
- `linked_question_id`
- `visibility`
- `created_at / updated_at`

Missing for `WU-N1`:

- `type`
- `body_json`
- `body_text`
- `word_count`
- `content_hash`
- `reaction_count`
- `comment_count`
- `bookmark_count`
- `is_featured`
- `deleted_at`
- the five Notes support tables

### 5. The live schemas are still the minimal placeholder shape

`schemas_v2.py` currently exposes:

- `NoteCreateRequestV2(title, body, linked_question_id, visibility)`
- `NoteUpdateRequestV2(title, body, status, linked_question_id, visibility)`
- `NoteDetailV2` / `NoteItemV2` with only the minimal fields

That does not match the canonical Notes data model in `01-Data-Model.md`.

## Contract Decisions

### D1. Runtime ownership

For `SIK-47`, the canonical runtime owner stays `modules/notes_v2`.

Why:

- it is already the only registered `/api/v2/notes` router
- switching runtime ownership to the legacy `modules/notes` tree inside the same issue would mix migration work with functional CRUD work
- the old `modules/notes` question-note and notebook code can stay untouched until a later cleanup issue

Implication:

- `SIK-47` will extend `modules/notes_v2` into the real M1 Notes CRUD module
- legacy `modules/notes/interface/routes.py` remains unregistered
- legacy `modules/notes/interface/notebook.py` remains out of scope

### D2. Database owner

`NoteV2` continues to live in `services/api/src/sikao_api/db/models_v2.py`.

`SIK-47` will:

- extend `NoteV2`
- add:
  - `NoteTagV2`
  - `NoteImageV2`
  - `NoteReactionV2`
  - `NoteCommentV2`
  - `NoteBookmarkV2`

No separate model file split is attempted in this issue.

### D3. Canonical write format

The canonical source of note content becomes `body_json`.

Rules:

- `body_json` is the write-time canonical content
- `body_text` is derived from `body_json`
- `word_count` is derived from `body_text`
- `content_hash` is derived from canonicalized `body_json`
- the legacy `body` column remains present for compatibility/backfill, but new CRUD writes will keep it synchronized from `body_text`

### D4. API contract shape

The active `/api/v2/notes` CRUD adopts the canonical M1 request/response model.

Create request:

- `title`
- `body_json`
- `type`
- `visibility`
- `linked_question_id`
- `tags`

Update request:

- partial update for:
  - `title`
  - `body_json`
  - `visibility`
  - `linked_question_id`
  - `tags`

Detail response includes at least:

- `id`
- `title`
- `type`
- `visibility`
- `body_json`
- `body_text`
- `word_count`
- `linked_question_id`
- `linked_question_brief`
- `tags`
- `reaction_count`
- `comment_count`
- `bookmark_count`
- `is_featured`
- `is_bookmarked`
- `is_reacted`
- `author_name`
- `created_at`
- `updated_at`

List response item includes at least:

- `id`
- `title`
- `type`
- `body_preview`
- `word_count`
- `linked_question_id`
- `tags`
- `reaction_count`
- `comment_count`
- `updated_at`

### D5. Scope limits

`SIK-47` does not implement:

- tag management endpoints
- Meilisearch sync/search
- image upload
- AI summary
- weekly review generation
- community visibility endpoints

But schema and service design must not block those later milestones.

## Migration Contract

Create one new Alembic revision after the current head.

The migration must:

1. Extend `notes_v2`
2. Create the five support tables
3. Backfill existing note rows:
   - `body_text = body`
   - `word_count` from `body`
   - `type = 'question_level'` when `linked_question_id IS NOT NULL`, else `free`
   - `body_json = NULL`
   - counts default to `0`

The migration does not drop:

- `body`
- `note_links_v2`
- any legacy notebook tables

## Validation Contract

Before `SIK-47` can be marked done:

- independent subagent review must cover:
  - migration contract
  - runtime owner decision
  - CRUD boundary
- validation must include:
  - targeted Postgres pytest for Notes CRUD
  - fresh `alembic upgrade head`
  - fresh `alembic downgrade -1`
  - targeted `ruff`
  - targeted `mypy`
  - `main.py` route smoke through the active app
