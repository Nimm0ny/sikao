---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-26
source: multica
multica-issue: SIK-51
---

# SIK-51 Notes Community P1 Contract

## Goal

Implement Notes M5 backend for:

- public/private visibility switching
- read-only community feed
- linked-question community filtering
- public-note audit and search-sync behavior

without introducing a second inconsistent write path.

## Current Reality

1. `modules/notes_v2` owns the active Notes runtime, but there is no community service, no community routes, and no community response schema.
2. `NoteV2.visibility`, `reaction_count`, `comment_count`, `bookmark_count`, and `is_featured` already exist on the runtime model.
3. `notes_v2` already has the partial DB index `ix_notes_v2_community_feed` on `(visibility, created_at)` with `deleted_at IS NULL`.
4. The active Notes CRUD routes still accept `visibility` through generic `POST /api/v2/notes` and `PUT /api/v2/notes/{id}`.
5. `notes_v2` search sync already indexes `visibility`, `tags`, and `linked_question_id`, but there is no dedicated runtime path for community-specific sync semantics yet.
6. The user model has `display_name`; there is no separate runtime `nickname` field in `UserV2`.

## Contract Decisions

### D1. Runtime ownership

`SIK-51` stays entirely under `modules/notes_v2`.

New runtime pieces:

- `application/community_service.py`
- route additions under `interface/routes.py`
- repo additions under `infrastructure/repos.py`

No legacy `modules/notes/` code is touched.

### D2. Author-name contract

For Community P1, the issue text's “nickname” is implemented as `UserV2.display_name`.

Reason:

- current runtime has no separate nickname column
- inventing a parallel nickname source here would be an undocumented boundary fork

### D3. Visibility gate ownership

Community publish rules are owned by a shared Notes-community validator, not by a single route handler.

Therefore:

- `PATCH /api/v2/notes/{note_id}/visibility` is the canonical narrow toggle endpoint
- generic `POST /api/v2/notes` and `PUT /api/v2/notes/{note_id}` must also respect the same `public` gate

This prevents `public` writes from bypassing the 50-character rule through the existing CRUD boundary.

### D4. Publish threshold

Publishing to `visibility="public"` requires stripped `body_text` length `>= 50`.

Evaluation source:

- derived `body_text`, not raw `body_json`

Failure:

- `422`
- code `content_too_short`

### D5. Community feed read path

Community P1 feed is read from PostgreSQL, not from Meilisearch.

Reason:

- P1 requires stable `latest / hottest / featured` ordering plus `linked_question_id` and tag filters
- there is no P1 community full-text search endpoint
- DB already has the partial feed index and authoritative counters

Meilisearch remains a synchronized read-model dependency, not the source of truth for the feed API.

### D6. Search-sync strategy

Community P1 reuses the existing shared `notes` index instead of creating a separate `community_notes` runtime index.

Implications:

- public/private transitions must re-upsert the note into the shared notes index
- soft delete keeps the existing delete sync path
- no new Meilisearch endpoint or second index client is introduced in `SIK-51`

This satisfies the issue’s “community index or shared notes index” allowance without splitting the search write path prematurely.

### D7. Audit contract

Visibility transitions must write `AuditLogV2`.

Canonical action names:

- `notes.community.visibility_updated`

Audit payload must include:

- `before.visibility`
- `after.visibility`
- note id
- request id when available

### D8. Community feed contract

Route:

- `GET /api/v2/notes/community`

Supported query params:

- `page`
- `size`
- `sort=latest|hottest|featured`
- `linked_question_id`
- `tags`

Compatibility rule:

- the route accepts both `linked_question_id` and `linkedQuestionId`
- if both are provided, they must match

Feed rows include:

- note identity
- title
- body preview
- word count
- linked question id
- tags
- reaction/comment counters
- `is_featured`
- author name from `display_name`
- timestamps

Only rows satisfying `visibility='public' AND deleted_at IS NULL` are eligible.

### D9. Toggle route contract

Route:

- `PATCH /api/v2/notes/{note_id}/visibility`

Request body:

- `{"visibility":"private"|"public"}`

Response:

- note id
- resolved visibility
- updated timestamp

Changing `public -> private` must make the note disappear from the community feed immediately in the same transaction boundary.

## Validation Contract

Before `SIK-51` can be marked done:

- independent subagent review must cover visibility gate consistency, search sync, and privacy boundary behavior
- backend scoped validation must include targeted Postgres/API tests
- validation must prove:
  - `public` publish fails below 50 characters
  - `private` notes never appear in community feed
- `public -> private` disappears immediately
- `latest / hottest / featured` ordering is correct
  - `linked_question_id` filtering returns only matching public notes
- cross-user visibility works for public notes only
