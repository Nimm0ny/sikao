---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-65
---

# SIK-65 Review Cause Feedback Contract

## Goal

补齐 `TX15 / AC16` 的后端真实 contract：为 Review cause-analysis 落地 `feedback` 端点、持久化结构和可聚合查询，使 `dimensions_disagreed` 不再只是文档条目。

## Current Evidence

- `docs/vault/05-migration/Phase/Review/06-AI-Cause-Analysis.md` 已定义：
  - `POST /api/v2/review/cause-analysis/{analysis_id}/feedback`
  - body 含 `rating / comment / dimensions_disagreed / actions_unhelpful`
  - `AC16 = 反馈 down + dimensions_disagreed -> metadata 写入 + 周报告聚合`
- `docs/vault/05-migration/Phase/Review/13-Cause-Taxonomy.md` 已定义：
  - `Taxonomy-8`：👎 + `dimensions_disagreed` 要按 tag 聚合
  - `TX15`：`rating=down, dimensions_disagreed=[X]` 必须写入 feedback metadata
- 当前 repo 现实：
  - `RecommendationFeedbackV2` 只有 `recommendation_id / reason / note / created_at`
  - Review module 没有 `cause-analysis/{analysis_id}/feedback` 路由
  - Review tests / OpenAPI 里都没有 feedback path

## Define-First Boundary

- 继续沿用 `RecommendationFeedbackV2` 作为统一 feedback ledger，不新建平行 `cause_analysis_feedback_v2` 表。
- 但该表必须升级为可同时承载两类记录：
  - `recommendation_reject`
  - `cause_analysis_single` / `cause_analysis_group`

## Data Model Contract

### `RecommendationFeedbackV2`

新增/调整字段：

- `recommendation_id: int | null`
  - recommendation reject 行必填
  - cause-analysis feedback 行为 `null`
- `analysis_id: int | null`
  - FK -> `ai_cause_analysis_v2.id`
  - cause-analysis feedback 行必填
  - recommendation reject 行为 `null`
- `feedback_type: str`
  - allowed:
    - `recommendation_reject`
    - `cause_analysis_single`
    - `cause_analysis_group`
- `rating: str | null`
  - allowed for cause-analysis rows: `up | down`
  - recommendation reject 行为 `null`
- `reason: str`
  - recommendation reject：保留现有 reject reason
  - cause-analysis feedback：固定写 `user_feedback`
- `note: str | null`
  - recommendation reject：沿用现有 note
  - cause-analysis feedback：承载 `comment`
- `metadata_json: dict`
  - default `{}`
  - cause-analysis feedback shape:
    - `rating`
    - `comment`
    - `dimensions_disagreed`
    - `actions_unhelpful`
  - recommendation reject 行为 `{}`

约束：

- `feedback_type = recommendation_reject`
  - `recommendation_id IS NOT NULL`
  - `analysis_id IS NULL`
  - `rating IS NULL`
- `feedback_type IN (cause_analysis_single, cause_analysis_group)`
  - `analysis_id IS NOT NULL`
  - `recommendation_id IS NULL`
  - `rating IN ('up', 'down')`

### Why This Shape

- 与 Review docs 的 `RecommendationFeedbackV2(...)` 约定保持一致，不额外发明新表。
- 保留现有 recommendation reject 路径，避免破坏 Home 已落地能力。
- `analysis_id` 顶层化，避免仅靠 `metadata_json.analysis_id` 做 owner lookup。
- `rating` 顶层化，保留文档里按 `type + rating` 聚合的查询语义；同时把原始 request 全量存入 `metadata_json`，便于 prompt 调参与审计。

## API Contract

### Route

- `POST /api/v2/review/cause-analysis/{analysis_id}/feedback`

### Auth

- require `get_current_user_v2`
- require `verify_csrf_v2`

### Request Body

- `rating: "up" | "down"`
- `comment: str | null`
- `dimensions_disagreed: list[str]`
- `actions_unhelpful: list[int]`

### Validation Rules

- `analysis_id` 必须属于当前用户
- 仅 `scope = single | group` 的 `AiCauseAnalysisV2` 可提交 feedback
- `dimensions_disagreed`
  - only allowed when `rating = down`
  - entries must be distinct
  - every slug must be in current active taxonomy
  - max length `<= 5`
- `actions_unhelpful`
  - only allowed when `rating = down`
  - entries must be distinct
  - every index must be `0 <= idx < len(result_json.suggested_actions)`
- `comment`
  - trim
  - blank -> `null`
  - max length `<= 500`

### Response

- `OperationAckV2`
  - `ok=true`
  - `status="stored"`

## Persistence Contract

- insert one `RecommendationFeedbackV2` row per request
- `feedback_type` derived from `AiCauseAnalysisV2.scope`
  - `single -> cause_analysis_single`
  - `group -> cause_analysis_group`
- `rating/comment/dimensions_disagreed/actions_unhelpful` write through into `metadata_json`
- do not mutate `AiCauseAnalysisV2.result_json`
- add audit log:
  - `action = "review.cause_analysis.feedback_submitted"`
  - `target_type = "ai_cause_analysis_v2"`
  - `target_id = analysis_id`

## Aggregation Contract

新增 query/service helper，供 weekly report / later cron 复用：

- `list_top_disagreed_dimensions(session, *, since: datetime, limit: int = 5) -> list[dict]`

语义：

- source rows:
  - `feedback_type IN ('cause_analysis_single', 'cause_analysis_group')`
  - `rating = 'down'`
- explode `metadata_json.dimensions_disagreed`
- group by slug
- count desc

本 issue 只要求 helper + tests；不要求把它接入新的 scheduler job。

## OpenAPI / Test Contract

必须新增并锁定：

- OpenAPI path:
  - `/api/v2/review/cause-analysis/{analysis_id}/feedback`
- tests:
  - happy path single feedback
  - happy path group feedback
  - `rating=up` 时拒绝 `dimensions_disagreed`
  - invalid slug -> 422
  - invalid action index -> 422
  - owner isolation
  - aggregation helper returns top disagreed slugs
  - existing recommendation reject flow remains backward compatible

## Out Of Scope

- 不在本 issue 实现 frontend thumbs UI
- 不在本 issue 落 weekly cron writer / audit summary consumer
- 不实现 `save-as-note`
- 不改 LLM prompt / parser 逻辑（除非为 slug validation 所需）

## Acceptance Mapping

- `TX15`：feedback down + `dimensions_disagreed` 持久化可证
- `AC16`：feedback metadata 写入 + 可聚合查询存在并通过测试
- recommendation reject 现有测试继续通过
- OpenAPI drift 覆盖新 feedback path
