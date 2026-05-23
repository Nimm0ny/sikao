---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-24
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Hook B23.4 Slice

## Goal

收口 `B23.4`：把 `session.submit` 后的增量 stats hook 与 Home recommender refresh 收敛成统一 submit hook 入口，并确保 hook 失败不会回滚已成功提交的 session 主事务。

## Define-First Boundary

### Hook Surface

- 新增 `services/api/src/sikao_api/modules/session/application/hooks.py`
- 对外只暴露两层能力
  - `on_session_submit(...)`
    - submit 主事务提交后调用
    - 负责 dispatch progress / recommender follow-ups
  - `run_progress_submit_hooks_isolated(...)`
    - 在独立 session 中跑 `run_progress_submit_hooks`
    - 失败只记日志，不向外抛

### Submit Path Coverage

- 普通 `POST /api/v2/practice/sessions/{id}/submit`
  - 主事务先提交
  - 再调用 `on_session_submit(...)`
- `mock_exam` force submit 路径
  - `auto_submit_expired_mock_exams()` 完成 business submit 后，复用同一套 progress hook 隔离执行
  - recommender refresh 仍由 scheduler job wrapper 在外层统一 enqueue

### Progress Hook Semantics

- 业务内容不变
  - `practice_stats.snapshot_writer.incremental_update(user_id, session_id)`
  - `progress.snapshot_writer.refresh_daily_progress_snapshot(user_id)`
  - `progress.snapshot_writer.refresh_weekly_weakness_snapshot(user_id)`
- 运行方式
  - `home_scheduler` 可用且 enqueue 成功时：走 one-shot async job
  - `home_scheduler` 缺失、未运行、enqueue 返回 `False` 或抛错时：立即走 `run_progress_submit_hooks_isolated()` fallback
- fallback 必须：
  - 使用 fresh session
  - 自己 commit / rollback
  - 不影响已经成功提交的 `PracticeSessionV2.status="submitted"`

### Recommender Hook Semantics

- `home_scheduler` 可用时：
  - `enqueue_submit_recommender_refresh(user_id, session_id, request_id)`
- `home_scheduler` 缺失或 enqueue 失败时：
  - 仅记录日志
  - 不做同步 fallback
- 理由：
  - recommender refresh 可能触发 LLM /较重查询，不允许在 submit request 上阻塞
  - `B23.4` 只承诺“通知首页推荐器”，不承诺“在无 scheduler 环境下同步完成推荐刷新”

### Failure Semantics

- submit 主事务成功后：
  - progress fallback 失败：只记日志，HTTP 仍返回 `200 submitted`
  - recommender enqueue 失败：只记日志，HTTP 仍返回 `200 submitted`
- 仍保留 fail-fast 于主事务内部逻辑
  - `service.submit()` 失败
  - `timing summary` 失败
  - `daily completion / essay submission / flag promotion` 等主事务内失败
  - 这些仍应回滚 submit

### Testing Surface

- 更新
  - `services/api/tests/test_practice_stats_submit_hook_v2.py`
  - `services/api/tests/test_ai_questions_feedback_submit_hooks_v2.py`
  - `services/api/tests/test_home_phase_m5_progress_hooks.py`
  - `services/api/tests/test_postgres_mock_exam_force_submit_v2.py`
- 至少覆盖
  - scheduler disabled 时，submit 仍完成且 progress fallback 生效
  - progress fallback 抛错时，submit 不回滚
  - scheduler enqueue 返回 `False` 时走 progress fallback
  - mock exam auto submit 路径仍能触发 progress hook，且 hook 失败不阻塞其他已成功 force-submitted rows

## Out Of Scope For This Slice

- `B30 question_report`
- `B24` final OpenAPI / e2e closeout
