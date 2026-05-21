# Phase-Home · 03 · Backend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；每个 PR 必须含测试

---

## 0. WU 总览

| # | WU | 估算 | PR 数 | 依赖 |
|---|---|---|---|---|
| WU-B1 | 数据建模 + Alembic | 800 | 5 | - |
| WU-B2 | plans 模块（事件 CRUD + recurring + conflict） | 2,400 | 7 | B1.1 / B1.2 / B1.4 |
| WU-B3 | recommendations 模块 | 900 | 3 | B1.3 / B2.2 |
| WU-B4 | progress 真实化 + snapshot 写入 | 1,400 | 4 | B2.2 |
| WU-B5 | planning 重写（dashboard 入口） | 1,100 | 4 | B2.2 / B4.1 |
| WU-B6 | profile 扩展 | 250 | 2 | B1.4 |
| WU-B7 | LLM 模块 | 2,000 | 6 | B1.1 / B1.3 / B1.4 |
| WU-B8 | Cron + 实时 hook | 1,000 | 4 | B7 / B4 |
| WU-B9 | E2E + OpenAPI 验收 | 1,400 | 5 | B2-B8 |
| **合计** | | **11,250** | **40** | |

> 后端总量上调（原 7,500），原因：补全 audit / idempotency / observability / 完整鉴权层。

---

## 1. 全局规范

### 1.1 路由分组

所有 V2 路由在 `services/api/src/sikao_api/main.py` 注册前缀 `/api/v2`。本 plan 新增模块挂载点：

```python
# main.py（增量）
app.include_router(plans_router,           prefix="/api/v2")
app.include_router(recommendations_router, prefix="/api/v2")
# 已存在的 dashboard / progress / planning / profile 路由不变
```

### 1.2 鉴权与授权

所有端点 `Depends(get_current_user)` 注入；返回 401 / 403 走全局错误处理。

**资源所属校验**：每个 mutation / read-by-id 端点必须在 service 层调 `assert_owner(user_id, resource)`，违反返回 `404 Not Found`（不是 403，避免泄漏存在性）。

```python
# 通用模式
def assert_owner(user_id: int, resource_user_id: int) -> None:
    if user_id != resource_user_id:
        raise NotFoundError("resource not found")
```

### 1.3 错误码枚举

新模块统一使用 `services/api/src/sikao_api/core/errors.py` 已有约定：

| code | http | 用途 |
|---|---|---|
| `VALIDATION_FAILED` | 422 | pydantic 校验失败 |
| `RESOURCE_NOT_FOUND` | 404 | 包括越权伪装 |
| `CONFLICT` | 409 | 同 active plan / 重名 / RRULE 冲突 |
| `LLM_SERVICE_UNAVAILABLE` | 503 | AI 服务失败兜底 |
| `LLM_PARSE_FAILED` | 502 | AI 输出无法解析 |
| `RATE_LIMITED` | 429 | NF-RateLimit |
| `IDEMPOTENT_REPLAY` | 200 | 命中幂等缓存（实际是成功） |
| `BAD_RECURRING_RULE` | 422 | RRULE 子集外 |

### 1.4 限流（NF-RateLimit）

中间件 `RateLimitMiddleware`：
- LLM 端点：每用户 10 req/min（slowapi + storage：Stage 1 内存，Stage 2 Redis）
- events bulk / events range：每用户 60 req/min
- 其他写端点：每用户 120 req/min
- 命中限流写 audit + 返回 429 + `Retry-After` header

### 1.5 幂等中间件（AI-8）

```
@app.middleware("http")
async def idempotency_middleware(request, call_next):
    if request.method == "POST" and request.url.path in IDEMPOTENT_PATHS:
        key = request.headers.get("Idempotency-Key")
        if not key or not is_uuid(key):
            return error(VALIDATION_FAILED)
        cached = await idempotency_repo.get(key, user_id, path)
        if cached and cached.request_hash == sha256(body):
            return cached.response  # IDEMPOTENT_REPLAY
        ...
```

`IDEMPOTENT_PATHS` 限于 `POST /plans/auto-generate`, `POST /plans/events/regenerate-range`, `POST /recommendations/refresh`。

### 1.6 OpenAPI Tag 约定

| tag | 端点前缀 |
|---|---|
| plans | /plans, /plans/events, /plans/adjustments |
| recommendations | /recommendations |
| dashboard-progress | /dashboard/progress* |
| dashboard-planning | /dashboard/today*, /weekly-plan*, /full-plan |
| profile | /profile/* |

### 1.7 Review / Validation Gate（适用于所有 B*.x PR）

- 每个后端 runtime PR 必须先过独立 review；单 tranche diff 超过 400 行时再加 master diff review。
- 涉及 DB migration、API 契约、鉴权、LLM、限流、幂等等高风险改动时，不允许只贴单测结果；必须附 targeted integration evidence。
- 默认验证命令：相关范围的 `ruff`, `mypy`, `pytest`；涉及 route/schema 的 PR 额外跑 OpenAPI drift。
- `B9` 之前允许按 tranche 跑 targeted validation；Home 后端整体验收仍以 `B9` 的 full validation 为准。

---

## 2. WU-B1 · 数据建模

### B1.1 PlanV2 + PlanEventV2 模型 + Alembic

**文件**：
- `services/api/src/sikao_api/db/models_v2.py`（追加 `PlanV2` / `PlanEventV2`）
- `db/enums.py` (PlanStyle/PlanStatus/PlanSource/EventCategory/EventStatus/EventSource)
- `database/migrations/versions/2026XXXX_b1_1_*.py`
- `tests/db/test_plan_v2_model.py`
- `tests/db/test_plan_event_v2_model.py`

**验收**：
- 所有 enum 行 fixture 生成成功
- partial unique index `(user_id) WHERE status='active' AND deleted_at IS NULL` 测试覆盖（双写第二个 active 时 IntegrityError）
- CheckConstraint `end_at > start_at` 测试
- `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` 全 PASS

### B1.2 PlanAdjustmentV2

**文件**：`services/api/src/sikao_api/db/models_v2.py`（追加 `PlanAdjustmentV2`） + 迁移 + 测试

**验收**：partial index `WHERE status='pending'` 命中；status enum 完整。

### B1.3 RecommendationV2 + Feedback

**文件**：`services/api/src/sikao_api/db/models_v2.py`（追加 `RecommendationV2` / `RecommendationFeedbackV2`） + 迁移 + 测试

### B1.4 Profile 扩展 + 链接 + 系统表

**文件**：
- 扩展 `services/api/src/sikao_api/db/models_v2.py`：`ProfileGoalV2.exam_targets`
- 扩展 `services/api/src/sikao_api/db/models_v2.py`：`ProfileInfoV2.ai_adjust_enabled / dashboard_preferences / recommender_preferences`
- 扩展 `services/api/src/sikao_api/db/models_v2.py`：`PracticeSessionV2.linked_plan_event_id / linked_recommendation_id`
- 追加 `IdempotencyKeyV2 / AuditLogV2 / LlmCallV2`
- 迁移 + 测试

**验收**：所有新字段默认值正确；FK on_delete=SET NULL；audit_log 多态 metadata schema 测试。

### B1.5 Drop DailyPlanV2 / WeeklyPlanV2

**前置**：本 PR 之前必须先完成 `B5.1` 旧 planning cleanup 与 `B5.1a legacy study_plan cleanup`。grep 关键字 = `daily_plan_v2`, `weekly_plan_v2`, `DailyPlanV2`, `WeeklyPlanV2`。

**文件**：
- 从 `services/api/src/sikao_api/db/models_v2.py` 删除 `DailyPlanV2 / DailyPlanItemV2 / WeeklyPlanV2` class 定义
- `database/migrations/versions/2026XXXX_b1_5_drop_*.py`：`op.drop_table('daily_plan_v2'); op.drop_table('weekly_plan_v2')`
- downgrade 留空（用户拍板：项目未上线，不需回滚）

**验收**：upgrade head 成功；codebase grep 0 引用。

---

## 3. WU-B2 · plans 模块

### 3.1 模块布局

```
services/api/src/sikao_api/modules/plans/
  __init__.py
  domain/
    __init__.py
    entities.py             # Pydantic domain models（区别于 ORM）
    rrule_subset.py         # RRULE 解析与校验（python-dateutil + 子集白名单）
    recurring_expander.py   # M → instances，detached X 应用
    conflict_detector.py    # event 重叠判定
    state_machine.py        # event status transitions
    practice_block.py       # P4 实绩块装配
  application/
    __init__.py
    plan_service.py         # plan CRUD
    event_service.py        # event CRUD（含 scope=this/future/all）
    adjustment_service.py   # adjustment accept/reject
  infrastructure/
    __init__.py
    repos.py                # SQLAlchemy 仓储
  interface/
    __init__.py
    routes_plans.py
    routes_events.py
    routes_adjustments.py
```

请求/响应 schema 现实收敛：
- 所有对外 API schema 统一追加到 `services/api/src/sikao_api/db/schemas_v2.py`
- `modules/plans/interface/*` 只负责 route wiring，不再新建独立 `interface/schemas.py`

### 3.2 端点全集

```
# Plans
GET    /api/v2/plans                                     列表
POST   /api/v2/plans                                     创建（手动）
GET    /api/v2/plans/{plan_id}                           详情
PUT    /api/v2/plans/{plan_id}                           编辑（goal / focus / style）
DELETE /api/v2/plans/{plan_id}                           软删
POST   /api/v2/plans/{plan_id}/archive                   归档
POST   /api/v2/plans/{plan_id}/activate                  激活（其他 active 自动 paused）
POST   /api/v2/plans/{plan_id}/pause                     暂停
POST   /api/v2/plans/auto-generate                       AI 制定（要 Idempotency-Key + SSE）

# Events
GET    /api/v2/plans/events?from=&to=&include_practice_blocks=  范围查询（默认范围 ≤ 90 天）
POST   /api/v2/plans/events                              创建
GET    /api/v2/plans/events/{event_id}                   详情（id 可为虚拟实例 ID）
PATCH  /api/v2/plans/events/{event_id}?scope=this|future|all   编辑
DELETE /api/v2/plans/events/{event_id}?scope=this|future|all   软删
POST   /api/v2/plans/events/bulk-delete                  批量软删（按 plan_id / from-to / source）
POST   /api/v2/plans/events/conflicts                    冲突检测（不写库，只返回冲突列表）
POST   /api/v2/plans/events/regenerate-range             AI 局部重生成（要 Idempotency-Key + SSE）
POST   /api/v2/plans/events/{event_id}/restore           恢复软删（30 天内）

# Adjustments
GET    /api/v2/plans/adjustments?status=pending         列表
GET    /api/v2/plans/adjustments/{id}                    详情
POST   /api/v2/plans/adjustments/{id}/accept             接受 → 落地 PlanEventV2 变更 + audit
POST   /api/v2/plans/adjustments/{id}/reject             body: {reason?}
```

### 3.3 PR 拆分

#### B2.1a plans 主表 list/create/get

文件：
- `domain/entities.py`（PlanCreate/Read schema）
- `application/plan_service.py`（list/create/get）
- `infrastructure/repos.py`（PlanRepo）
- `interface/routes_plans.py`
- `db/schemas_v2.py`
- `tests/modules/plans/test_plan_routes.py`

业务规则：
- create 时如果用户已有 active plan，新 plan status 默认 `paused`（除非 body 显式 `make_active=true`，此时把旧的 active 转 paused 并加 audit）
- get/list 默认过滤 soft-deleted plan

PR 行数：~210

#### B2.1b plans 主表 update/archive/activate/pause/delete

文件：
- `domain/entities.py`（PlanUpdate schema 增量）
- `application/plan_service.py`（update/archive/activate/pause/soft_delete）
- `infrastructure/repos.py`（PlanRepo 增量）
- `interface/routes_plans.py`
- `db/schemas_v2.py`
- `tests/modules/plans/test_plan_routes.py`

业务规则：
- activate 同理
- update 限定字段：`name / daily_minutes_target / style / focus_subjects / target_exam_date`；改其他字段返回 422

PR 行数：~190

#### B2.2 events 基础 CRUD

文件：
- `domain/state_machine.py`（事件状态转换，详见 02-Data-Model §3.2）
- `application/event_service.py`（list/create/get/single-update/single-delete）
- `infrastructure/repos.py`（EventRepo 增量）
- `interface/routes_events.py`（不含 bulk / conflicts / regenerate / scope）
- `db/schemas_v2.py`（增量）
- `tests/modules/plans/test_event_routes.py`

业务规则：
- list 默认 `include_practice_blocks=false`；`from-to` 跨度 ≤ 90 天，超出 422
- create 时 `recurring_rule` 非空必须经 rrule_subset.validate
- `scope` 参数仅当 `recurring_parent_id` 非空（虚拟或 detached）时有效

PR 行数：~380

#### B2.3 events 高级（bulk + conflicts + practice_blocks）

文件：
- `domain/conflict_detector.py`
- `domain/practice_block.py`
- `application/event_service.py`（增量：bulk_delete / detect_conflicts / list_with_practice_blocks）
- `interface/routes_events.py`（增量）
- `tests/modules/plans/test_conflicts.py`
- `tests/modules/plans/test_practice_blocks.py`

业务规则：
- `bulk-delete` body: `{plan_id?, from?, to?, source?, dry_run?}`；dry_run 返回将被删的 ids 列表不实际删
- `conflicts` body: `{events: [proposed_event...], existing_window?: {from, to}}`；不写库
- `practice_blocks` 取 PracticeSessionV2 WHERE `linked_plan_event_id IS NULL` AND `(started_at, submitted_at)` 与查询窗口相交

PR 行数：~350

#### B2.4 RRULE 解析 + 展开 + 例外

文件：
- `domain/rrule_subset.py`（whitelist 校验 + parse）
- `domain/recurring_expander.py`（母规则 + detached + EXDATE 展开为虚拟实例）
- `tests/modules/plans/test_rrule_subset.py`
- `tests/modules/plans/test_recurring_expander.py`

测试覆盖必须含：DAILY/WEEKLY/MONTHLY × COUNT/UNTIL × BYDAY/BYMONTHDAY × EXDATE 主要组合 ≥ 18 个 case；非白名单 RRULE 必拒 ≥ 5 case。

PR 行数：~390（含测试）

#### B2.5 重复事件 scope=this/future/all

文件：
- `application/event_service.py`（增量：scope_this_create_detached / scope_future_split / scope_all_update_master）
- `interface/routes_events.py`（PATCH/DELETE 增量）
- `tests/modules/plans/test_recurring_scope.py`

业务规则：
- `scope=this` 编辑 → 创建 detached X 行；母规则 `recurring_exception_dates` 加该日
- `scope=this` 删除 → 仅在母规则 `recurring_exception_dates` 加该日，不创建 detached
- `scope=future` → 截断 M.UNTIL = 该日 -1；创建 M2 从该日开始；旧的 detached 在该日之前的保留，之后的失效（标 deleted）
- `scope=all` → 直接改 M（含 RRULE 改写时，已有 detached 必须保留 + 警告）

PR 行数：~300

#### B2.6 plan adjustments 路由

文件：
- `application/adjustment_service.py`（list / get / accept / reject）
- `interface/routes_adjustments.py`
- `tests/modules/plans/test_adjustment_routes.py`

业务规则：
- accept → 应用 changes 到 events（按 changes[i].action: edit/add/delete），每条变更各自写 change_log + audit_log；写 adjustment.status=accepted, decided_at=now
- reject → 只更新 status / user_reject_reason
- expired 由 cron 处理（B8.3）
- 同一 plan 多个 pending 时不互斥（用户可选择）

PR 行数：~280

**B2 验收**：
- 全部端点 contract test 过
- recurring expander 测试 ≥ 30 case
- conflict detector 边界 ≥ 10 case（含跨日 / 同一秒 / 重复事件展开后冲突）
- practice_block 与 events 联合返回 e2e

---

## 4. WU-B3 · recommendations 模块

### 4.1 模块布局

```
modules/recommendations/
  domain/
    entities.py
    signal_collector.py     # 收集 source_signals（records / review.items / WeaknessSnapshot / plan / live session）
    dedup.py                # Rec-8 去重
  application/
    recommendation_service.py
  infrastructure/
    repos.py
  interface/
    routes.py
    schemas.py
```

### 4.2 端点

```
GET  /api/v2/recommendations/today                 当前 active recs（最多 3）
POST /api/v2/recommendations/refresh               强制刷新（要 Idempotency-Key）
POST /api/v2/recommendations/{id}/accept           body: {action: "session"|"plan", target_date?: "YYYY-MM-DD"}
POST /api/v2/recommendations/{id}/reject           body: {reason: "...", note?: "..."}
GET  /api/v2/recommendations/history?from=&to=     历史
```

### 4.3 PR 拆分

#### B3.1 路由 + signal_collector + 基础

文件：
- `domain/signal_collector.py`：聚合实绩、目标差距、疲劳、错题积压、近期错误率
- `domain/dedup.py`：Rec-8 去重逻辑
- `application/recommendation_service.py`：list_today / refresh / get_history
- `interface/routes.py` + `schemas.py`
- `tests/modules/recommendations/test_signals.py`
- `tests/modules/recommendations/test_dedup.py`

业务规则：
- `today` 端点：取 user_id 下 status=pending AND expires_at>now 的最新 ≤3 条
- `refresh`：调 LLM recommender（实际调用层在 B7）；本 PR 用 stub `await recommender_service.generate_for_user(user_id)`，B7 接入真实
- 去重：generate 后落库前过 dedup 过滤，不够 3 条则减 1 重 generate（最多 1 次）

PR 行数：~340

#### B3.2 accept 双分支

文件：
- `application/recommendation_service.py`（增量：accept_to_session / accept_to_plan）
- `interface/routes.py`（增量）
- `tests/modules/recommendations/test_accept.py`

业务规则：
- `action=session`：创建 PracticeSessionV2 并写 `linked_recommendation_id`（不写 linked_plan_event_id）；返回 `{session_id, redirect_url}`
- `action=plan`：必须带 `target_date`；从 payload 推导 PlanEventV2（默认 18:00 + estimated_minutes 时长）；写 source=ai_generated；返回 `{event_id}`
- 两分支均写 recommendation.status=accepted_session/accepted_plan + audit

PR 行数：~290

#### B3.3 reject + history

文件：
- `application/recommendation_service.py`（增量：reject / history）
- `interface/routes.py`（增量）
- `tests/modules/recommendations/test_reject_history.py`

业务规则：
- reject 写 RecommendationFeedbackV2 + 更新主表 status=rejected
- history 默认返回最近 30 天，分页 `?page=&size=`（最多 size=50）

PR 行数：~270

---

## 5. WU-B4 · progress 真实化 + snapshot 写入

### 5.1 关键约束

进度数据**完全独立于 PlanEventV2.status**（P2/P3）。仅基于 `PracticeSessionV2 + ProgressSnapshotV2 + WeaknessSnapshotV2 + EssaySubmissionV2 + EssayReportV2`。

invariant test：`tests/invariants/test_p2_progress_independent.py` 必须通过。

### 5.2 端点

```
GET /api/v2/dashboard/progress                          summary + plan_slice（含 weakness_top3）
GET /api/v2/dashboard/progress/timeseries?from=&to=&granularity=day|week  趋势
GET /api/v2/dashboard/progress/weakness                 多维强弱（全量）
GET /api/v2/dashboard/progress?plan_id=                 同上端点，加 plan slice
GET /api/v2/dashboard/progress/diagnosis                诊断报告（基于近 30 天）
```

### 5.3 PR 拆分

#### B4.1 summary + diagnosis 真实化

文件：
- `modules/progress/application/progress_service.py`（重写 summary / diagnosis）
- `modules/progress/domain/aggregator.py`（聚合 today/week/all_time/plan_slice）
- `modules/progress/interface/routes.py`（增量）
- `tests/modules/progress/test_summary.py` / `test_diagnosis.py`

业务规则：
- plan_slice 在 plan_id 为空时取 user 的当前 active plan；否则用指定 plan_id
- diagnosis 输入 = 近 30 天 sessions + weakness 当前快照；输出 = `{strengths[], weaknesses[], suggestions[]}` 结构
- 如没有 ProgressSnapshot 当日记录，real-time 聚合（不依赖 snapshot 也能跑，但 snapshot 是性能优化）

PR 行数：~370

#### B4.2 timeseries（含 day/week 粒度）

文件：
- `domain/timeseries.py`（按 day/week 聚合 + ProgressSnapshot 优先 + 当日 fallback 实时计算）
- `interface/routes.py`（增量）
- `tests/modules/progress/test_timeseries.py`

业务规则：
- granularity=day 时窗口 ≤ 90 天；granularity=week 时窗口 ≤ 52 周
- 字段：accuracy / minutes_practiced / items_answered / sessions_count

PR 行数：~280

#### B4.3 weakness 真实化

文件：
- `domain/weakness.py`（多维聚合：科目 × 子题型 × 难度，正确率 / 题量 / 趋势）
- `interface/routes.py`（增量）
- `tests/modules/progress/test_weakness.py`

PR 行数：~310

#### B4.4 snapshot 写入 + session.submit hook

文件：
- `modules/progress/application/snapshot_writer.py`（progress + weakness 全量）
- `modules/progress/application/session_hooks.py`（submit hook：增量更新 weakness）
- 接入点：`modules/answer_session/.../on_submit.py`（dispatch 到 progress.session_hooks）
- `tests/modules/progress/test_snapshot.py`

业务规则：
- progress snapshot：每用户每日一条；cron 调用 = 全量重算当日（B8.1）
- weakness snapshot：每用户每周一条；session submit 增量更新 in-memory cache + 写日终 snapshot
- 失败必须显式抛错（fail-fast，AGENTS-H7），不静默吞

PR 行数：~340

---

## 6. WU-B5 · planning 重写

### 6.1 端点变更

```
GET /api/v2/dashboard/today                       PlanEventV2 today 范围（虚拟实例展开）
GET /api/v2/dashboard/today/continue              PracticeSessionV2 in_progress
GET /api/v2/dashboard/today/review                review.items 高优先
GET /api/v2/dashboard/weekly-plan                 PlanEventV2 week 范围 + summary
GET /api/v2/dashboard/weekly-plan/goal            PlanV2 字段
GET /api/v2/dashboard/weekly-plan/today-completion
PUT /api/v2/dashboard/weekly-plan/adjust          调整 plan goal（落 PlanV2.update + audit）
GET /api/v2/dashboard/full-plan                   ← 新增（H-Plan-1 完整计划视图）

# 删除
GET /api/v2/dashboard/today/must-do               (Infra-Plan-must-do = 删除)
```

### 6.2 PR 拆分

#### B5.1 today + continue + review 重写 + must-do 删除

文件：
- 重写 `modules/planning/application/planning_service.py`（today / continue / review）
- 删除 `must-do` 路由 + service 方法
- `tests/modules/planning/test_today.py` 重写

业务规则：
- today 端点返回今日范围内 events（含虚拟实例展开），按 status 分组（in_progress / planned / done / skipped）
- continue 端点取 user 最近的 in_progress session（即未提交）
- review 端点从 review.items 选近 7 天高优先（错题密度高 + 距上次复盘 > 3 天）

PR 行数：~320

#### B5.1a legacy study_plan cleanup

文件：
- grep 删除所有 `daily_plan_v2 / weekly_plan_v2 / DailyPlanV2 / WeeklyPlanV2` 引用
- 删除 `services/api/src/sikao_api/modules/llm/application/llm/prompts/study_plan.py`
- 清理引用该 prompt 的 legacy wiring / 测试

业务规则：
- 这是 `B1.5` 的明确前置 cleanup PR，不再使用含糊的 `B1.6` 叫法。
- Home 新一代 `plan_generate.py` / `plan_adjust.py` / `recommend_today.py` 与 legacy `study_plan.py` 不并存上线。

PR 行数：~120

#### B5.2 weekly-plan 4 端点重写 + adjust

文件：
- `application/weekly_plan_service.py`
- `interface/routes_weekly.py` 重写
- `tests/modules/planning/test_weekly.py`

业务规则：
- weekly-plan：本周（周一-周日）events + summary（计划分钟 / 实做分钟 / 完成度）
- goal：从 PlanV2 取
- today-completion：今日 events 中 done count / total count
- adjust（PUT）：仅允许改 daily_minutes_target / focus_subjects / style；其他改走 PUT /plans/{id}

PR 行数：~330

#### B5.3 full-plan + 倒数考试日 + 多 target

文件：
- `application/full_plan_service.py`
- `interface/routes_full.py`
- `tests/modules/planning/test_full_plan.py`

业务规则：
- full-plan body（GET query）：`view=today|week|month`；`anchor_date=YYYY-MM-DD`（默认 today）
- 响应：events + plan summary + 多 exam_targets 倒数（取最近未来）+ 实绩块（include_practice_blocks=true 默认）
- 多 target 时 events 字段附 target_id；前端按 target_id 上色

PR 行数：~340

---

## 7. WU-B6 · profile 扩展

### 7.1 端点

```
PUT /api/v2/profile/goals                  body: {exam_targets: [...], ...}
PUT /api/v2/profile/info                   body: {ai_adjust_enabled?, dashboard_preferences?, recommender_preferences?}
GET /api/v2/profile/records                query: {page,size,kind,status,from,to,session_id}
```

### 7.2 PR 拆分

#### B6.1 goals 扩展（exam_targets）

文件：
- `modules/profile_v2/application/service.py`（增量：goals.exam_targets 校验 + 写入）
- `db/schemas_v2.py`（增量）
- `tests/modules/profile/test_goals.py`

业务规则：
- exam_targets 数组长度 ≤ 5
- 每条 exam_id 唯一
- exam_date 必须 ≥ today（前后端双校验）
- 旧字段向后兼容基于仓库现实：读取时保留 `target_exam / target_score / weekly_target_hours`，写入 `exam_targets` 后不删除旧字段
- 迁移期间：
  - 若 body 只传 legacy `target_exam / target_score / weekly_target_hours`，继续按旧语义写入
  - 若 body 传 `exam_targets`，则新字段优先；legacy 字段可作为兼容展示或默认值来源，但不能假设存在 `exam_id / exam_date`

PR 行数：~140

#### B6.2 info 扩展 + records canonicalization

文件：
- `modules/profile_v2/application/service.py`（增量：info）
- `modules/profile_v2/interface/routes.py`（增量：`GET /profile/records`）
- `modules/record/application/service.py`（复用现有聚合逻辑，输出 canonical `LearningRecordListResponseV2`）
- `db/schemas_v2.py`（增量）
- `tests/modules/profile/test_info.py`
- `tests/modules/profile/test_records.py`

业务规则：
- `GET /api/v2/profile/records` 是唯一 canonical records API。
- 现有 `GET /api/v2/dashboard/records` 作为兼容 shim 暂保留到 `B9.5` 前；返回中的 `href/actions` 一律改为 `/profile/records`。
- records 继续复用 `modules/record` 聚合，不把 records 语义绑回 `/dashboard`。

PR 行数：~180

---

## 8. WU-B7 · LLM 模块

详见 `05-LLM-Module.md` 与 `06-LLM-Prompts.md`。本节只列 PR 拆分摘要。

> 实现现实（A0 修订）：WU-B7 全程**扩展现有 `services/api/src/sikao_api/modules/llm/`**，沿用当前 `httpx` OpenAI-compatible provider 与 BYOM 结构，不新建 `modules/llm_v2/`。

### 8.1 PR 拆分（与 LLM 模块文档对齐）

| PR | 内容 | 行数 |
|---|---|---|
| B7.1 | LLM service 框架 + provider 抽象 + 配置 + cache + cost tracker | ~380 |
| B7.2 | OpenAI 兼容 client + DeepSeek/百炼 wrapper + mock provider + SSE 支持 | ~360 |
| B7.3 | plan_generator + prompts/parsers + sanitization | ~340 |
| B7.4 | plan_adjustor + prompts/parsers | ~290 |
| B7.5 | recommender + recommender_policy.py + prompts/parsers | ~330 |
| B7.6 | LLM 模块单测 + JSON mode fallback 测试 + 真 provider 联调脚本 | ~300 |

---

## 9. WU-B8 · Cron + 实时 hook

### 9.1 任务清单

| ID | 任务 | 频率 | 依赖 |
|---|---|---|---|
| C-1 | ProgressSnapshot 全量写入 | 每日 00:30 | B4.4 |
| C-2 | WeaknessSnapshot 全量重算 | 每周一 01:00 | B4.4 |
| C-3 | plan_adjustor 跑全部 active plan | 每日 06:00 | B7.4 |
| C-4 | event status 时间驱动更新 | 每 15 分钟 | B2.5 |
| C-5 | adjustment / recommendation 过期清理 | 每日 02:00 | B2.6 / B3.3 |
| C-6 | 软删事件物理清理（30 天） | 每日 03:00 | B2.5 |
| C-7 | login hook 调 adjustment 检查 | 实时 | B7.4 |
| C-8 | event skipped hook（C-4 触发后立即触发） | 实时 | B7.4 |
| C-9 | session.submit hook → recommender 实时刷新 | 实时 | B7.5 |

### 9.2 PR 拆分

#### B8.1 APScheduler 集成 + ProgressSnapshot + event-status cron

文件：
- `services/api/src/sikao_api/core/scheduler.py`（APScheduler lifespan 集成）
- `services/api/src/sikao_api/scheduler/jobs/progress_snapshot.py`
- `services/api/src/sikao_api/scheduler/jobs/event_status_tick.py`
- `tests/scheduler/test_progress_snapshot_job.py`
- `tests/scheduler/test_event_status_tick.py`

业务规则：
- Stage 1：MemoryJobStore + BlockingScheduler 单 worker
- Stage 2 切换：把 jobstore 换 SQLAlchemyJobStore + 单 worker 锁；本 PR 用 ABC `JobStoreProvider` 抽象
- 失败重试：每个任务包 try/except，失败写 audit_log + 抛错被 scheduler 记录；不静默吞

PR 行数：~360

#### B8.2 WeaknessSnapshot cron + session.submit hook

文件：
- `scheduler/jobs/weakness_snapshot.py`
- `modules/answer_session/application/on_submit.py`（增量：dispatch progress + weakness 更新）
- `tests/scheduler/test_weakness_snapshot.py`
- `tests/modules/answer_session/test_on_submit_hooks.py`

PR 行数：~280

#### B8.3 plan_adjustor cron + login hook + skipped hook + 过期清理 + 物理清理

文件：
- `scheduler/jobs/plan_adjustor_daily.py`
- `scheduler/jobs/cleanup_expired.py`
- `scheduler/jobs/cleanup_soft_deleted.py`
- `modules/identity/application/service.py`（增量：登录后触发 adjustor 检查）
- 接入 event-status-tick：标 skipped 后 enqueue adjustor
- `tests/scheduler/test_plan_adjustor_cron.py`
- `tests/scheduler/test_cleanup_jobs.py`
- `tests/modules/identity/test_login_hook.py`

业务规则（ADJ-6 限流）：
- adjustor 入口先查近 24h 同 user_id 是否已生成同类 adjustment（按 changes diff 哈希），命中则跳过
- 限流计数写 audit_log

PR 行数：~390

#### B8.4 session.submit hook → recommender 实时刷新

文件：
- `modules/answer_session/application/on_submit.py`（增量：dispatch recommender refresh）
- 异步 enqueue（asyncio task，Stage 1；Stage 2 切 worker queue）
- `tests/modules/answer_session/test_recommender_refresh.py`

业务规则：
- session.submit 不应阻塞返回；recommender 刷新走后台任务
- 刷新前先检查上次 generated_at 是否 < 5 min（防抖）

PR 行数：~220

---

## 10. WU-B9 · E2E + OpenAPI 验收

### 10.1 PR 拆分

#### B9.1 plans + events e2e

文件：
- `tests/e2e/test_plans_lifecycle.py`（create plan → events → recurring → conflicts → adjust → archive）
- `tests/e2e/test_events_recurring_scope.py`

主链路场景：
1. create plan + events（含 RRULE）
2. 范围查询返回虚拟实例 + 实绩块
3. 编辑 scope=this 创建 detached
4. 编辑 scope=future 截断 + 创建 M2
5. bulk-delete + restore
6. archive plan 后 events 不可改

PR 行数：~340

#### B9.2 recommendations e2e

文件：
- `tests/e2e/test_recommendations.py`：refresh → accept(session) → 验证 session linked → reject → feedback 落库

PR 行数：~220

#### B9.3 progress e2e（含 timeseries / weakness / slice）

文件：
- `tests/e2e/test_progress_full.py`
- 主链路：用户做 session → snapshot 写入 → progress endpoints 返回 → P2 验证（伪造 event status，进度不变）

PR 行数：~280

#### B9.4 planning + profile e2e

文件：
- `tests/e2e/test_dashboard_today_weekly_full.py`
- `tests/e2e/test_profile_extension.py`

主链路补充：
- `GET /api/v2/profile/records` 分页 / 过滤 / `session_id` deep-link 查询
- `GET /api/v2/dashboard/records` shim 在前端切换前仍返回兼容 payload

PR 行数：~280

#### B9.5 OpenAPI 重生成 + drift 测试

文件：
- `services/api/scripts/export_openapi.py`（如不存在则新建）
- `services/api/spec/openapi.json`（重生成）
- `tests/contract/test_openapi_drift.py`：跑时实时 generate vs file，diff 必须为空
- `packages/api-client/src/types/api.generated.ts`（基于 openapi.json 重生成 ts types，本 PR 仅生成不消费）

收口要求：
- 删除 legacy `GET /api/v2/dashboard/records` shim，只保留 canonical `GET /api/v2/profile/records`
- 锁定后的 `openapi.json` 不再包含 `/dashboard/records`

PR 行数：~280（其中 openapi.json 自动生成不计入手写）

### 10.2 完工 gate

- `pytest -q` 全绿
- `alembic upgrade head` 干净
- OpenAPI drift test 0 diff
- LLM mock provider 跑通所有 prompt
- 真 provider 至少手动跑通 plan_generate / recommend_today 各一次

---

## 11. PR 列表（40 个）

```
B1.1  PlanV2 + PlanEventV2 + Alembic
B1.2  PlanAdjustmentV2 + Alembic
B1.3  RecommendationV2 + Feedback + Alembic
B1.4  Profile + Session links + Idempotency + Audit + LlmCall + Alembic
B1.5  Drop DailyPlanV2 / WeeklyPlanV2

B2.1a plans 主表 list/create/get
B2.1b plans 主表 update/archive/activate/pause/delete
B2.2  events 基础 CRUD + state machine
B2.3  events bulk + conflicts + practice_blocks
B2.4  RRULE subset + recurring_expander
B2.5  events scope=this/future/all
B2.6  plan adjustments 路由

B3.1  recommendations 基础 + signal_collector + dedup
B3.2  recommendations accept 双分支
B3.3  recommendations reject + history

B4.1  progress summary + diagnosis 真实化
B4.2  progress timeseries
B4.3  progress weakness
B4.4  snapshot writer + session.submit hook

B5.1  dashboard today + continue + review + must-do 删除
B5.1a legacy study_plan cleanup
B5.2  weekly-plan 4 端点 + adjust
B5.3  full-plan + 倒数 + 多 target

B6.1  profile goals exam_targets
B6.2  profile info ai_adjust + dashboard_prefs + recommender_prefs + records canonicalization

B7.1  LLM service 框架 + provider 抽象 + config + cache + cost
B7.2  OpenAI 兼容 client + DeepSeek + 百炼 + mock + SSE
B7.3  plan_generator + prompts/parsers + sanitization
B7.4  plan_adjustor + prompts/parsers
B7.5  recommender + recommender_policy + prompts/parsers
B7.6  LLM 单测 + JSON mode fallback + 真 provider 脚本

B8.1  APScheduler + ProgressSnapshot + event-status tick
B8.2  WeaknessSnapshot cron + session.submit progress hook
B8.3  plan_adjustor cron + login hook + skipped hook + cleanup
B8.4  session.submit recommender refresh hook

B9.1  e2e plans + events
B9.2  e2e recommendations
B9.3  e2e progress
B9.4  e2e planning + profile
B9.5  OpenAPI 重生成 + drift 测试 + ts types 生成
```

---

## 12. 引用矩阵

| 本文档被引用 |
|---|
| `04-Frontend-WU.md` 端点列表 |
| `05-LLM-Module.md` WU-B7 PR 拆分 |
| `08-NonFunctional.md` 限流 / 幂等 / cron 部署形态 |
| `09-Observability-Audit.md` audit 写入点 |
| `10-Testing.md` e2e 场景与 invariant test 列表 |
