---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-49
---

# SIK-49 Notes Meilisearch Contract

## Goal

Implement Notes M3 search on top of `SIK-47` and `SIK-48`:

- Meilisearch-backed note indexing
- `GET /api/v2/notes/search`
- startup index init
- write-side degrade-to-audit behavior

without touching community-note indexing or frontend search UI.

## Current Reality

1. `modules/notes_v2` is the active Notes runtime owner, and `routes.py` already carries CRUD, tags, images, and export.
2. There is no `meilisearch_client.py`, no Notes search service, no `/api/v2/notes/search`, and no Notes search response DTO in `schemas_v2.py`.
3. Current Notes write transaction boundaries live in `routes.py`: service mutates, route commits.
4. `add_audit_log(...)` already exists and can record write-side degrade events.

## Conflict Handling

`SIK-49` explicitly requires write-side search sync failures to not block note save, which conflicts with `AGENT-H7 Fail-Fast`.

This issue will therefore register a scoped fail-fast exception for:

- write-side Meilisearch sync failure -> audit + continue
- startup index init failure -> warn + continue boot

Search endpoint failures do **not** get a degrade path; they remain hard `503 SEARCH_UNAVAILABLE`.

## Contract Decisions

### D1. Runtime ownership

All `SIK-49` runtime work stays under `modules/notes_v2`. We do not revive legacy `modules/notes/*`.

### D2. Config contract

`core/config.py` will add:

- `meili_url: str | None = None`
- `meili_master_key: str | None = None`
- `meili_index_name: str = "notes"`
- `meili_timeout_seconds: int = 3`

`meili_url` absent means Notes search is disabled/unavailable. Half-config states must fail fast during settings validation.

### D3. Index document contract

The Notes index document stays aligned with Notes Phase SSOT:

- `id`
- `user_id`
- `title`
- `body_text`
- `tags`
- `type`
- `visibility`
- `linked_question_id`
- derived `has_linked_question`
- `created_at`
- `updated_at`

### D4. Write-side sync ownership

Search sync will be triggered from Notes write routes **after the DB commit succeeds**, not before commit inside mutation methods.

Reason: current runtime commits in `routes.py`; syncing before commit can index rolled-back rows and breaks DB-as-SSOT.

### D5. Search endpoint contract

`GET /api/v2/notes/search` will accept:

- `q`
- optional `filters`
- `page`
- `size`

`filters` remains a validated Notes-specific grammar and the backend always injects current-user isolation on top of it.

Response adds `NoteSearchResponseV2` with:

- `items`
- `total`
- `page`
- `page_size`
- `facet_distribution`

### D6. Startup init contract

App startup attempts idempotent Notes index init when `meili_url` is configured:

- ensure index exists
- apply Notes search settings from Notes SSOT

Init failure must not block app boot, but must be observable in logs and the fail-fast exception register.

## Out of Scope

- community index
- frontend search UI
- Docker-based Meilisearch setup
- non-Notes search reuse/refactor

## Validation Contract

Before `SIK-49` can be marked done:

- independent subagent review must cover filter injection, degrade strategy, and audit boundary
- targeted Postgres/API tests must cover sync create/update/delete, user isolation, facets, and `503 SEARCH_UNAVAILABLE`
- mock Meilisearch client tests must cover startup init and write-side degrade behavior
- targeted `ruff` and `mypy` must pass
