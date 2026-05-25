---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-25
source: multica
multica-issue: SIK-65
---

# SIK-65 Review Cause Deep Contract

## Goal

补齐 `SIK-65` acceptance 中缺失的 `cause_analysis_deep` 后端能力：至少让 Review cause-analysis runtime 能处理 `mode=deep`，并通过 mock/provider smoke 走通独立深度分析分支。

## Current Evidence

- Review 规范明确存在 `cause_analysis_deep`：
  - `docs/vault/05-migration/Phase/Review/06-AI-Cause-Analysis.md`
  - mode 应为 `single | forced | deep`
  - `daily_deep_quota = 5`
- 当前 repo 现实：
  - `CauseAnalysisRequestV2.mode` 只支持 `single | forced`
  - `services/api/src/sikao_api/modules/llm/application/llm/prompts/` 下没有 `cause_analysis_deep.py`
  - `ReviewCauseAnalysisService` 没有 deep 分支
  - `HomeLlmQuotaService` 没有 deep 独立桶
  - hard-question cron 已存在，但只做 `is_hard` 标记，不会 dispatch deep 分析

## Define-First Boundary

- 本次只补“可调用的 deep runtime contract”，不在 `SIK-65` 里新增后台自动 dispatch job。
- `hard_question_detector` / `DebtService` 保持现状；deep 的自动调度仍可后续单开 issue。
- 但只要 item 已被标记 `is_hard=true`，当前 Review cause-analysis endpoint 必须能接受 `mode=deep` 并走独立配额 / prompt。

## Request Contract

### `POST /api/v2/review/items/{item_id}/cause-analysis`

- `mode: "single" | "forced" | "deep"`

### Validation

- `single`
  - 现状不变
- `forced`
  - 现状不变
- `deep`
  - 仅允许 `item.metadata_json.is_hard == true`
  - 否则返回 `409 review_cause_analysis_mode_invalid`

## Prompt Contract

新增：

- `services/api/src/sikao_api/modules/llm/application/llm/prompts/cause_analysis_deep.py`

输入至少包含：

- `question_type`
- `category_l1 / category_l2`
- `question_body`
- `options_text`
- `correct_answer`
- `explanation`
- `error_count`
- `answer_history_block`
- `confidence_history`
- `avg_duration_s`
- `duration_ratio`
- `re_fail_count`
- `total_wrong_count`
- `historical_dimensions_freq`
- `taxonomy_block`

输出沿用现有 `CauseAnalysisPayload` shape，不单独发明 deep schema。

## Persistence Contract

- `AiCauseAnalysisV2.scope` 仍为 `single`
- `result_json.mode = "deep"`
- `_meta.prompt_template_version = "cause_analysis_deep@v1"`
- deep 成功后写：
  - `metadata_json.last_deep_analysis_at = now`
- deep 缓存键继续复用 single-analysis cache 模型，但 `mode="deep"` 必须参与 `input_hash`

## Quota Contract

- `single + group`
  - 保持现有 `review_cause_analysis = 20/day`
- `forced`
  - 继续 exempt
- `deep`
  - 新增独立 purpose / bucket：
    - `review_cause_analysis_deep = 5/day`
  - 不消耗普通 `review_cause_analysis = 20/day` 桶
  - 仍计入全局 `llm_quota_per_user_per_day`

## Service Contract

`ReviewCauseAnalysisService.analyze_single(...)` 增加 deep 分支：

- 读取 hard-item 上下文：
  - `re_fail_count`
  - `total_wrong_count`
  - `historical_dimensions_freq`
- 选择 `cause_analysis_deep` prompt
- 走独立 deep quota
- 成功后更新 `last_deep_analysis_at`

## Test Contract

必须新增并通过：

- prompt builder 单测：
  - deep prompt 注入 `re_fail_count / total_wrong_count / historical_dimensions_freq`
- PostgreSQL runtime：
  - hard item + `mode=deep` 成功
  - non-hard item + `mode=deep` -> 409
  - deep quota 独立于 normal quota
  - deep 成功写 `last_deep_analysis_at`
- mock provider:
  - `cause_analysis_single / group / forced / deep` 四类全部可跑

## Out Of Scope

- 不在 `SIK-65` 实现 cron 自动触发 deep
- 不在 `SIK-65` 补 frontend hard banner / auto-trigger
- 不在 `SIK-65` 新增 deep 专属 endpoint

## Acceptance Mapping

- `SIK-65` 里 “LLM mock provider 跑通 cause_analysis_* 全套” 的 `deep` 分支补齐
- deep mode 成为真实 backend contract，而不是只存在于文档
