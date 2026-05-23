---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-23
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Essay Grading V2 Slice

## Goal

先收口 `B20.1 + B20.2`：把 v2 申论批改主链接回当前 app，包括 submission 触发、异步批改、轮询状态、结果读取，以及 `EssayReportV2` 持久化。

## Current Reality

- `create_app()` 当前没有注册任何 essay 路由，`modules/essay/interface/routes.py` 的旧 `/api/v2/essay/*` 能力不在现行 app 表面。
- `EssaySubmissionV2 / EssayReportV2 / EssayReferenceAnswerV2` 表已存在，但生产代码里没有 v2 essay grading runtime。
- `A0-Codebase-Reality-Check` 记载“`EssaySubmissionV2` 仅 session.submit 时写入”，但当前 `modules/session/application/service.py` 现实里并未写入该表，属于文档与代码 drift。

## Define-First Boundary

### Module Ownership

- 新增 `services/api/src/sikao_api/modules/essay_grading/`
- 本轮不复用旧 `modules/essay/*` 路由；旧模块仍保留为 legacy helper source，不挂到 `create_app()`

### Route Surface

- `POST /api/v2/practice/essay/submissions/{submission_id}/grade`
  - 需要认证 + CSRF + `Idempotency-Key`
  - 同步触发异步批改任务，立即返回当前 `EssayGradingResponseV2`
- `GET /api/v2/practice/essay/submissions/{submission_id}/grading-status`
  - 返回当前批改状态 envelope
- `GET /api/v2/practice/essay/submissions/{submission_id}/result`
  - 当前阶段返回与 `grading-status` 同 shape；由 caller 依据 `status` 判定是否展示完整结果

### Session Integration

- `SessionServiceV2.submit()` 在 `practice_session.track == "essay"` 时创建一条 `EssaySubmissionV2`
- 每个 essay `practice_session_id` 仅允许关联一条 submission；重复提交 session 仍按现有冲突逻辑 fail-fast，不产生第二条 submission

### Submission / Report Lifecycle

- `EssaySubmissionV2.status`
  - `submitted`：session 已提交，尚未触发批改
  - `pending_grading`：已触发批改，后台任务进行中
  - `graded`：批改成功，存在 `EssayReportV2(status="completed")`
  - `failed`：批改失败；允许再次触发 `POST /grade`
- `EssayReportV2.status`
  - `pending`：已排队
  - `completed`：有完整 report
  - `failed`：失败原因写入 `feedback_json.error_message`

### Serialization Contract

- route response 统一使用现有 `db.schemas_v2.EssayGradingResponseV2`
- `status` 直接暴露真实 submission/report 当前状态组合
  - 未触发 `POST /grade` 前，`GET grading-status/result` 返回 `submitted`
  - 触发后才进入 `pending_grading`
- `report`
  - `total_score` 为 0-100 标尺
  - `dimensions / highlights / issues / overall_comment / improvement_suggestions / graded_at / llm_call_id` 必须完整
- `reference_answers`
  - 本轮只读现有 `EssayReferenceAnswerV2`，不负责生成；没有数据时返回空数组

### LLM Execution Path

- 后台批改调用 `modules.llm.application.service.HomeLlmService.grade_essay()`
- 不能直接绕过 facade 调裸 `grade_essay_with_trace()`，因为需要沿用 `LlmCallV2` 记录与 quota / failure recording 逻辑

### Reader Compatibility

- 现有依赖 essay 数据的 reader 必须兼容 `EssaySubmissionV2.status in {"submitted", "pending_grading", "graded", "failed"}`
- 受影响面至少包括：
  - `modules/practice_stats/application/essay_facts.py`
  - `modules/record/application/service.py`
  - `modules/progress/application/aggregates.py`

## Out Of Scope For This Slice

- `GET /practice/essay/questions/:id/reference-answers`
- `POST/DELETE like/favorite/report`
- `POST /practice/essay/reference-answers/generate`
- `question_report`
- B24 final OpenAPI / e2e closeout
