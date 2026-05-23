---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-24
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Cron B23.3 Slice

## Goal

收口 `B23.3`：把 `generate_daily_practice` 接到当前 scheduler 基座，在不阻塞单用户即时 `/practice/daily` 的前提下，为活跃用户预生成当日每日一练。

## Define-First Boundary

### Scheduler Surface

- 复用现有 `services/api/src/sikao_api/core/home_scheduler.py`
- 新增 recurring job
  - `practice.daily.generate`
  - `04:00`
  - timezone=`Asia/Shanghai`
- 复用 `HomeRuntimeOrchestrator` sync wrapper
- 失败处理沿用现有 scheduler 约定
  - job 级异常不静默吞错
  - 但单个用户/类型失败不能拖垮整批

### Cron Module Surface

- 新增 `services/api/src/sikao_api/cron/daily_practice_cron.py`
  - `generate_daily_practice(session: Session, settings: Settings, *, target_date: date | None = None, type_names: tuple[str, ...] = ("xingce", "essay")) -> DailyPracticeCronResult`
- 返回值至少包含
  - `generated_count`
  - `skipped_count`
  - `failure_count`

### Batch Semantics

- 候选用户：`UserV2.is_active = true`
- 处理粒度：`(user_id, type_name)` 二元组
  - 默认覆盖 `xingce` 与 `essay`
- 对每个 `(user, type)`：
  - 若当日 `DailyPracticeV2(user_id, date, type)` 已存在，`skip`
  - 若不存在，则复用现有 `daily_practice.application.service` 的生成逻辑创建一条 `DailyPracticeV2`
- 生成日期默认 `today_cn()`
- `DailyPracticeV2` 仍保持 `UNIQUE(user_id, date, type)`

### Failure Isolation

- 单个 `(user, type)` 的失败不能回滚其它用户/类型的成功结果
- 用 `session.begin_nested()` 或等价 savepoint 逐个隔离
- 失败后继续处理后续用户
- 常见失败：
  - `daily_practice_empty`
  - `ai question generation quota / llm failure`
  - 配置/数据异常

### Daily Generation Semantics

- 复用现有 `_generate_daily_row()` 的业务选择逻辑
  - `weakness_weighted`：有弱项快照时按弱项权重选题
  - `random_balanced`：否则按分类轮转均衡选题
  - `last_used_source_mode == "ai_generated"` 且 `type == "xingce"` 时允许走 AI 题池/LLM
  - `essay` 只走 real_exam 路径
- cron 只负责“预生成”
  - 不创建 session
  - 不改 `started_at`
  - 不改 `completed_session_id`

### Audit Semantics

- 成功生成一条 daily 时：
  - 写 `daily.generate`
  - `actor_type="system"`
  - `actor_id="practice.daily.generate"`
  - `target_type="daily_practice_v2"`
  - `target_id=row.id`
  - `metadata` 至少含 `type`, `date`, `strategy`
- 单个 `(user, type)` 失败时：
  - 写 `daily.generate_failed`
  - `actor_type="system"`
  - `actor_id="practice.daily.generate"`
  - `target_type="user_v2"`
  - `target_id=user.id`
  - `metadata` 至少含 `type`, `date`, `error`

### Query Surface Compatibility

- `GET /api/v2/practice/daily?type=...`
  - 仍保留“如不存在则即时生成”的兜底
  - cron 只是提前把大部分用户的 daily 预热好
- 若 cron 已生成，当日 GET 应直接命中既有 `DailyPracticeV2`

### Testing Surface

- Pure unit / scheduler
  - 扩展 `services/api/tests/test_home_scheduler_practice_jobs.py`
- PostgreSQL cron integration
  - `services/api/tests/test_postgres_daily_practice_cron_v2.py`
- 至少覆盖
  - 当日缺失时为活跃用户生成 `xingce` daily
  - 已有 row 时 `skip`
  - 单个用户/类型失败不阻塞其他成功项
  - 成功/失败 audit 写入
  - 结果计数正确

## Out Of Scope For This Slice

- `B23.4 session.submit` 增量 hook
- `B30 question_report`
- `B24` final OpenAPI / e2e closeout
