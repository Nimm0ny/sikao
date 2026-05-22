---
type: engineering
status: active
owner: codex
last-reviewed: 2026-05-22
source: multica
multica-issue: SIK-36
---

# SIK-36 Home M5 Cron Realtime Hooks

## Goal

为 Home Phase M5 落地独立的调度与实时触发层，把 progress / weakness / adjustment / recommendation 的后台行为从手工触发推进到正式 runtime。

## Current Evidence

- `SIK-35 / M4` 已完成，`modules/llm/` 已具备 `adjust_plan()` 与 `recommend_today()` 等 Home LLM 能力。
- `docs/vault/05-migration/Migration-Status.md` 仍写“当前下一活跃后端阶段是 `M4 / SIK-35`”，与真实账本状态漂移。
- `SIK-36` issue 描述引用的 `docs/plan/home-b8-b9-execution-baseline-2026-05-22.md` 与 `docs/plan/home-backend-first-unblock.md` 本地不存在。
- 当前 `services/api/src/sikao_api/main.py` 只启动 Profile deletion 自制 scheduler，不存在 Home scheduler substrate。
- 当前 `SessionServiceV2.submit()` 仍内联调用 `refresh_progress_artifacts_for_user()`；`IdentityServiceV2.login()` 不触发 Home adjustment check。

## Define-First Boundary

- Home scheduler 必须独立于 `core/scheduler.py` 的 Profile deletion 实现，新增 `core/home_scheduler.py`。
- `create_app()` lifespan 同时持有：
  - `app.state.deletion_scheduler`
  - `app.state.home_scheduler`
- Home scheduler 只负责：
  - recurring jobs: progress snapshot / weakness snapshot / event-status tick / cleanup / daily adjustor
  - one-shot jobs: login adjustment check / skipped adjustment check / submit recommender refresh
- realtime hook 语义固定为：
  - 主事务先成功提交
  - side effect 再通过 scheduler 异步触发
  - side effect 失败写 log / audit / metrics，不回滚主事务
- `SIK-36` 不改 OpenAPI 锁定、不删 records shim、不启动前端 runtime；这些仍属于 `SIK-37 / M6`。

## Job Inventory

| Key | Trigger | Responsibility |
|---|---|---|
| `home.progress_snapshot.daily` | 每日 00:30 | 为有 Home 数据的用户写当日 `ProgressSnapshotV2` |
| `home.weakness_snapshot.weekly` | 每周一 01:00 | 为有 Home 数据的用户写当周 `WeaknessSnapshotV2` |
| `home.event_status.tick` | 每 15 分钟 | 推进 `planned -> in_progress / skipped / done` |
| `home.cleanup.expired` | 每日 02:00 | 过期 `PlanAdjustmentV2` / `RecommendationV2` |
| `home.cleanup.soft_deleted_events` | 每日 03:00 | 物理清理软删 30 天以上的 `PlanEventV2` |
| `home.plan_adjust.daily` | 每日 06:00 | 对 active + enabled 用户跑 `adjust_plan()` |
| `home.hook.login_adjustment` | login commit 后 | 为单用户触发 adjustment check |
| `home.hook.skipped_adjustment` | event skipped 后 | 为单 plan / 单用户触发 adjustment check |
| `home.hook.submit_recommender_refresh` | session.submit commit 后 | 为单用户触发 recommendation refresh |

## Failure Semantics

- scheduler job 抛错：
  - 记录 `home_scheduler.job_failed`
  - 保留主调度器继续运行
  - 不把失败伪装为成功
- login / submit / tick 主事务成功后，one-shot job 失败：
  - 原始 HTTP / tick 行为保持成功
  - 单独记录 audit metadata + metrics + error log
- duplicate adjustment 去重：
  - 同 user + 24h 内同类 changes diff hash 不重复生成
  - 若 24h 内存在同类 rejected adjustment，也不再生成

## Ownership

本 issue 业务改动主要落在：

- `services/api/src/sikao_api/core/config.py`
- `services/api/src/sikao_api/core/home_scheduler.py`
- `services/api/src/sikao_api/main.py`
- `services/api/src/sikao_api/modules/session/application/service.py`
- `services/api/src/sikao_api/modules/identity/interface/routes.py`
- `services/api/src/sikao_api/modules/llm/application/*` 中与 runtime 编排直接相关的新增文件

测试新增以独立文件为主：

- `services/api/tests/test_home_phase_m5_scheduler.py`
- `services/api/tests/test_home_phase_m5_progress_hooks.py`
- `services/api/tests/test_home_phase_m5_adjustment_jobs.py`
- `services/api/tests/test_home_phase_m5_recommender_hook.py`

## Tranche Breakdown

1. `B8.0` docs baseline + status drift fix
2. `B8.1a` APScheduler substrate + lifespan + one-shot enqueue API
3. `B8.1b` progress snapshot + event-status tick
4. `B8.2` weekly weakness cron + submit progress boundary
5. `B8.3a` daily adjustor + cleanup jobs + dedupe
6. `B8.3b` login / skipped hook wiring
7. `B8.4` submit recommender refresh + observability收口

## Validation

- scoped `ruff`
- scoped `mypy`
- targeted `pytest`
- 独立 review agent 审查

## Known Drift Notes

- `SIK-36` issue 中引用的两份旧 `docs/plan/*` 文件本地不存在；本文件作为当前 define-first 基线替代。
- `SIK-29` 父 issue 描述里 `SIK-35` 仍显示 `todo`，不作为本地实现状态的判断依据。
