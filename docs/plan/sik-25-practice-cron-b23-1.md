---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-24
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Cron B23.1 Slice

## Goal

收口 `B23.1`：把 `question_accuracy` 与 `ai_cleanup` 两个基础 cron 接到当前 scheduler 基座，并提供可手动触发、可测试的实现。

## Define-First Boundary

### Scheduler Surface

- 复用现有 `services/api/src/sikao_api/core/home_scheduler.py`
- 新增两个 recurring jobs
  - `practice.question_accuracy.recompute`
    - `04:00`
    - timezone=`Asia/Shanghai`
  - `practice.ai_questions.cleanup`
    - `04:30`
    - timezone=`Asia/Shanghai`
- 两个 job 都走 `HomeRuntimeOrchestrator` 的 sync wrapper
- 失败处理沿用现有 scheduler 约定
  - 不静默吞错
  - `home_scheduler.job_failed` 记录
  - APScheduler listener 接收异常

### Cron Module Surface

- 新增 `services/api/src/sikao_api/cron/question_accuracy_cron.py`
  - `recompute_question_accuracy(session: Session) -> int`
- 新增 `services/api/src/sikao_api/cron/ai_cleanup_cron.py`
  - `cleanup_low_quality_ai_questions(session: Session, *, min_quality: float = 2.5, max_reports: int = 5) -> int`

### Question Accuracy Semantics

- 数据来源：`PracticeSessionAnswerV2 JOIN PracticeSessionV2`
- 只统计 `PracticeSessionV2.status = "submitted"` 的样本
- 只重算 `question_id IS NOT NULL` 且至少出现过一次提交答题记录的题
- 重算字段
  - `QuestionV2.answer_count = submitted answer row count`
  - `QuestionV2.historical_accuracy = correct / graded`
  - `graded = is_correct IS NOT NULL`
  - `graded = 0` 时 `historical_accuracy = 0.0`
- 不碰从未有提交记录的题，避免把导入时的默认难度占位值直接清零
- 对 `source in {"ai_generated", "ai_modified"}` 的题，重算后同步刷新 `quality_score / report_count`

### AI Cleanup Semantics

- 候选集：
  - `source in {"ai_generated", "ai_modified"}`
  - `is_active = true`
- cron 内先基于现有 AI feedback ground truth 重算
  - `report_count`
  - `quality_score`
- 自动下线条件：
  - `quality_score < 2.5`
  - 或 `report_count >= 5`
  - 或 `ai_self_audit_passed = false`
- 命中条件后：
  - `QuestionV2.is_active = false`
  - 写 audit `ai_question.auto_offline`
  - `before` 至少含 `is_active / quality_score / report_count`
  - `after` 至少含 `is_active=false`
- 不做自动重新上线
- `source = real_exam` 永不被该 cron 自动下线

### B30 Compatibility Contract

- `cleanup_low_quality_ai_questions()` 现在仍以 AI feedback audit 为 `report_count` ground truth
- 后续 `B30.2` 只允许在此函数内部追加 `question_report` 聚合 override
- 不允许到时另起第二套 AI 下线 cron

### Testing Surface

- Postgres tests
  - `services/api/tests/test_postgres_question_accuracy_cron_v2.py`
  - `services/api/tests/test_postgres_ai_cleanup_cron_v2.py`
- Pure unit test
  - `services/api/tests/test_home_scheduler_practice_jobs.py`
- 本 slice 不做 OpenAPI / route e2e
  - 留给 `B24`
  - `SIK-25` 仍保持 `in_progress`

## Out Of Scope For This Slice

- `B23.2 compute_reference_quality`
- `B23.3 generate_daily_practice`
- `B23.4 session.submit` 增量 hook
- `B30 question_report` 聚合接入
- `B24` final OpenAPI / e2e closeout
