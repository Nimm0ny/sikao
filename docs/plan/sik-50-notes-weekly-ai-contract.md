---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-26
source: multica
multica-issue: SIK-50
---

# SIK-50 Notes Weekly Review AI Summary Contract

## Goal

Implement Notes M4 backend for:

- weekly review note generation
- note-to-review-card AI summary

with persistent cache, idempotent replay, shared LLM quota behavior, and full review/runtime validation.

## Current Reality

1. `modules/notes_v2` owns the active Notes runtime, but there is no weekly review service, no AI summary service, and no Notes AI routes yet.
2. Home LLM infrastructure already exists for provider calls, SSE, `LlmCallV2`, and generic idempotency helpers.
3. Accepted Notes AI docs reference `AiSummaryCacheV2`, `WeeklyReviewCacheV2`, and `Markdown -> TipTap JSON`, but none of those runtime artifacts exist in the current repo.
4. `ReviewSourceKind.NOTE_CARD` already exists, and Review validators require `metadata_json.source_note_id` for that source kind.
5. Current quota reality is split:
   - review/home LLM paths use `LlmCallV2`-based quota checks
   - AI questions still use a separate request-count quota service

## Contract Decisions

### D1. Runtime ownership

`SIK-50` stays under `modules/notes_v2`, but route growth now justifies splitting new AI routes out of the current monolithic Notes router file.

### D2. Prompt ownership and version naming

New prompts live under `modules/llm/application/llm/prompts/` and follow the repo's existing `name@vN` version style:

- `note_summary_cards@v1`
- `cause_analysis_weekly@v1`

### D3. Persistent cache tables are in scope

`SIK-50` adds persistent runtime cache tables instead of in-memory fallback:

- `AiSummaryCacheV2`
- `WeeklyReviewCacheV2`

Reason: accepted Notes AI docs already treat these as durable cache/idempotency state, and using transient cache here would be a minimalization shortcut.

### D4. Markdown -> TipTap is in scope

`notes_v2/domain/tiptap_converter.py` must grow a real `md_to_json(...)` path for weekly review persistence. Weekly review output is not allowed to stay markdown-only in storage.

### D5. Idempotency contract

External HTTP idempotency stays aligned with current backend conventions:

- mutating AI endpoints require `Idempotency-Key` header
- existing generic helper stays UUID-based for the HTTP boundary

The issue's semantic key strings such as `weekly_review_{user}_{year}_{week}_{attempt}` become internal cache/replay identity, not raw client header format.

### D6. Weekly review contract

Route:

- `POST /api/v2/notes/weekly-review/generate`

Behavior:

- weekly window is current CN week (`Asia/Shanghai`, Monday 00:00 to now)
- aggregates come from `ReviewItemV2`, `ReviewAttemptV2`, `PracticeSessionAnswerV2`, and `NoteV2`
- final note persists as `NoteV2(type="weekly_review")`
- system tags include `周回顾` and `第{N}周`
- SSE envelope uses `data: {"type":"chunk"|"done"|"error", ...}\n\n`

### D7. AI summary contract

Routes:

- `POST /api/v2/notes/{note_id}/ai-summary`
- `POST /api/v2/notes/{note_id}/ai-summary/confirm`

Behavior:

- preview cache identity is `(note_id, content_hash, prompt_version)`
- confirm idempotency is owned by the cache row; repeated confirm on the same note version replays existing `ReviewItemV2` ids
- confirmed review cards write `source_kind="note_card"` and `metadata_json.source_note_id`

### D8. Shared quota bucket is in scope

To satisfy the named requirement that Notes AI shares a daily pool with cause-analysis and AI question generation, `SIK-50` introduces a shared LLM bucket over `LlmCallV2` purposes:

- `review_cause_analysis`
- `review_cause_analysis_deep`
- `question_generation`
- `notes_weekly_review`
- `notes_ai_summary`

This issue is therefore allowed to touch the review cause-analysis and AI question quota entry points.

## Validation Contract

Before `SIK-50` can be marked done:

- independent subagent review must cover LLM call flow, parser strictness, shared quota behavior, and idempotent replay
- mock-provider tests are mandatory
- one true-provider manual smoke is mandatory
- backend scoped validation must include targeted Postgres/API tests plus `ruff` and `mypy`
