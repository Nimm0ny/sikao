# Phase-Home · 10 · Testing

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

---

## 1. 测试金字塔

```
            ┌─────────────────┐
            │   E2E (~ 5%)    │  关键链路 / 跨模块
            └─────────────────┘
          ┌─────────────────────┐
          │ Integration (~25%)  │  模块边界 / contract
          └─────────────────────┘
        ┌─────────────────────────┐
        │   Invariant (~10%)      │  P1-P6 边界规则
        └─────────────────────────┘
      ┌─────────────────────────────┐
      │       Unit (~60%)            │  纯函数 / 单 class
      └─────────────────────────────┘
```

> **Invariant** 单独抽出来强调，因为 P1-P6 是本 Phase 的设计契约，必须在每次 PR 都跑。

---

## 2. 后端测试

### 2.1 工具

- pytest + pytest-asyncio
- httpx AsyncClient（不起 uvicorn，直接调 ASGI）
- factory-boy + Faker（数据 fixture）
- alembic-utils（迁移测试）
- testcontainers / pytest-postgresql（DB 隔离）

### 2.2 目录结构

```
services/api/tests/
  conftest.py
  factories/                       # factory-boy 工厂
    plan_factory.py
    event_factory.py
    user_factory.py
    session_factory.py
  fixtures/
    llm/                           # mock LLM 输出
      plan_generate/
        case_aggressive_60d/input.json
        case_aggressive_60d/output.json
        ...
  unit/                            # 单测，纯逻辑
    plans/
      test_rrule_subset.py
      test_recurring_expander.py
      test_conflict_detector.py
      test_state_machine.py
    llm/
      test_sanitizer.py
      test_parser_*.py
      test_cache.py
      test_quotas.py
    progress/
      test_aggregator.py
      test_timeseries.py
  integration/                     # 端点级（含 DB）
    plans/
      test_plan_routes.py
      test_event_routes.py
      test_adjustment_routes.py
    recommendations/
    progress/
    planning/
    profile/
  invariants/                      # P1-P6 边界
    test_p1_plan_layers.py
    test_p2_progress_independent.py
    test_p3_event_status.py
    test_p4_practice_block.py
    test_p5_recommender_inputs.py
    test_p6_audit.py
  e2e/                             # 跨模块完整链路
    test_plans_lifecycle.py
    test_events_recurring_scope.py
    test_recommendations.py
    test_progress_full.py
    test_dashboard_today_weekly_full.py
    test_profile_extension.py
  contract/                        # OpenAPI / 契约
    test_openapi_drift.py
    test_event_response_shape.py
  audit/                           # 审计 / 合规
    test_event_audit.py
    test_ai_audit.py
    test_redact.py
  observability/
    test_request_id.py
    test_metrics_emitted.py
  scheduler/                       # cron
    test_progress_snapshot_job.py
    test_event_status_tick.py
    test_plan_adjustor_cron.py
    test_cleanup_jobs.py
  perf/                            # 不进 CI 必经
    bench_recurring_expand.py
    bench_layout.py
```

### 2.3 关键 invariant 测试（详见 `01-Boundary-Rules.md` §6）

| Invariant | 实现 |
|---|---|
| P1 | 创建 plan 后，PlanV2 有 target_exam_date 但 PlanEventV2 是空的 |
| P2 | 写入 unlinked session → progress aggregator 输出包含该 session 的 minutes / items |
| P2 | mock event.status=skipped → progress aggregator 输出与 event.status=done 时一致（仅看实绩） |
| P3 | unlinked session.submit → 关联事件的 status 不变 |
| P4 | events?include_practice_blocks=true → unlinked session 出现在 practice_blocks |
| P5 | recommender 输入信号收集器调用 mock，断言收集的 signals 不含 PlanEventV2.status |
| P6 | 编辑 event → AuditLogV2 + PlanEventV2.change_log 都有记录，actor / before / after / reason 一致 |
| P6 | AI adjustment.accept 时 events 变更必须写 audit；adjustment.reject 不变更 events |

### 2.4 contract test（OpenAPI drift）

```python
# tests/contract/test_openapi_drift.py
def test_openapi_no_drift(app):
    expected = json.loads(Path("services/api/spec/openapi.json").read_text())
    actual = app.openapi()
    diff = deep_diff(expected, actual)
    assert diff == {}, f"OpenAPI drift detected:\n{pretty(diff)}"
```

每次 endpoint schema 改动必须重新 export + commit `openapi.json`。CI 跑此测试，drift 必 fail。

### 2.5 e2e 主链路（B9）

| 文件 | 主链路 |
|---|---|
| test_plans_lifecycle.py | create plan → events → recurring → conflicts → archive → 不可改 |
| test_events_recurring_scope.py | scope=this/future/all 编辑与删除全路径 |
| test_recommendations.py | refresh → accept(session) → linked → reject → feedback 落库 |
| test_progress_full.py | session 写入 → snapshot → progress 端点 → P2 验证 |
| test_dashboard_today_weekly_full.py | today / weekly / full-plan 一致性 |
| test_profile_extension.py | exam_targets 多目标 + ai_adjust 开关 + dashboard_preferences |

### 2.6 LLM 测试矩阵（详见 `06-LLM-Prompts.md` §7）

每个 prompt：
- ≥ 1 happy
- 1 invalid_json
- 1 schema_violation
- ≥ 2 business rule violation
- ≥ 2 edge case
- ≥ 5 few-shot case

LLM 集成测试用 `MockProvider` + fixture 文件，**不调真 API**。CI 强制 `LLM_PROVIDER=mock`。

真 provider 联调脚本 `services/api/scripts/llm_smoke.py` 手动跑（详见 `05-LLM-Module.md` §12.3）。

### 2.7 cron 测试

```python
@pytest.mark.asyncio
async def test_progress_snapshot_writes_one_per_user_per_day(db, factories):
    user = factories.user_with_sessions(count=10)
    job = ProgressSnapshotJob(db=db)
    await job.run(target_date=date.today())
    snapshots = await db.scalars(...).all()
    assert len(snapshots) == 1
    assert snapshots[0].user_id == user.id
```

每个 cron job 单测：
- happy 路径
- 空数据
- 失败抛错（不静默吞）
- DLQ 写入
- 重复执行幂等（同日重跑结果一致）

### 2.8 性能测试（不进 CI 必经）

```bash
pytest services/api/tests/perf -v --benchmark-save=current
```

跑后写 `tests/perf/results/<date>.json`，与上次比对趋势。回归 > 30% 警告。

---

## 3. 前端测试

### 3.1 工具

- vitest（jsdom env 默认；calendar-engine 用 node env）
- @testing-library/react
- MSW（mock API）
- vitest-axe（a11y）
- happy-dom 或 jsdom（按需）

### 3.2 目录结构

```
apps/web/src/
  components/.../  __tests__/        # 组件单测
  views/__tests__/                    # 视图集成测
  router/__tests__/

packages/calendar-engine/src/__tests__/
packages/calendar-engine/src/__tests__/perf/

tests/
  e2e/                                # vitest + MSW 端到端
    plan-section.spec.ts
    recommendation.spec.ts
    practice-block.spec.ts
    multi-day-event.spec.ts
  a11y/
    dashboard-a11y.spec.ts
    calendar-keyboard.spec.ts
    ai-dialog-a11y.spec.ts
  handlers/                           # MSW handlers SSOT
    v2/
      plans-handlers.ts
      events-handlers.ts
      recommendations-handlers.ts
      progress-handlers.ts
      dashboard-handlers.ts
      profile-handlers.ts
    fixtures/
      plans/
      events/
      recommendations/
      progress/
```

### 3.3 MSW handlers 约定

```ts
// tests/handlers/v2/events-handlers.ts
import { http, HttpResponse } from "msw";
import { fixtures } from "../fixtures";

export const eventsHandlers = [
  http.get("/api/v2/plans/events", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from")!;
    const to = url.searchParams.get("to")!;
    const includeBlocks = url.searchParams.get("include_practice_blocks") === "true";
    return HttpResponse.json({
      data: {
        events: fixtures.eventsInRange(from, to),
        practice_blocks: includeBlocks ? fixtures.practiceBlocksInRange(from, to) : [],
      },
      meta: { from, to, include_practice_blocks: includeBlocks, tz: "Asia/Shanghai" },
    });
  }),
  // POST / PATCH / DELETE ...
];
```

每个 endpoint 至少 1 个 handler；handler 必须返回符合 `02-Data-Model §6` shape 的 mock。

### 3.4 状态测试约定

每个数据驱动组件必测 4 状态（详见 `04-Frontend-WU.md` §1.2）：

```ts
describe("ProgressSection", () => {
  it("shows skeleton while loading", () => { ... });
  it("shows EmptyState when no data", () => { ... });
  it("shows ErrorState with retry on error", () => { ... });
  it("renders metrics when data ready", () => { ... });
});
```

### 3.5 E2E 场景（WU-F8）

| 场景 | 步骤 |
|---|---|
| 新用户首次 | login → onboarding → AiPlanGenerateDialog → 表单 → 看到日历有事件 |
| 老用户首页 | login → 看到 today segment 有事件、Section B 有数据、Section C 有推荐 |
| 拖拽事件 | 拖事件改时间 → API patch 调用 → 视觉更新 |
| 拖拽跨日 | Week 视图拖事件到下一天 → 跨日 patch 成功 |
| 接受推荐进 session | 点 "去做" → redirect to session → linked_recommendation_id 已写 |
| 接受推荐加入计划 | 点 "加入计划" → 选明日 → 事件出现在明日 |
| AI 调整 banner | 模拟 pending adjustment → banner 弹 → accept → 事件改变 |
| 推荐 reject | 点 "不感兴趣" → dialog → 提交 → feedback 落库 |
| 实绩块 | 模拟 unlinked session → 日历出现实绩块（虚线）|
| 多日事件 | 创建跨 3 天事件 → Week 视图条带渲染 |
| 软删除 + restore | 删事件 → 列表不显示 → restore → 重新出现 |
| 重复事件 scope | 编辑 → scope=this → detached 创建 |

### 3.6 a11y 测试（WU-F8.4）

```ts
// tests/a11y/calendar-keyboard.spec.ts
import { fireEvent } from "@testing-library/react";

it("can move event with arrow keys", async () => {
  const { getByRole } = renderDashboard();
  const block = await getByRole("button", { name: /行测·言语 30 题/ });
  block.focus();
  fireEvent.keyDown(block, { key: "ArrowDown" });
  fireEvent.keyDown(block, { key: "Enter" });          // 确认
  // 断言 patch 调用 + 时间偏移 1 hour
});
```

每个 PR 跑：

```bash
npm run test:a11y      # vitest-axe + 键盘流
```

axe violations 必须 0。

### 3.7 calendar-engine 测试（详见 `07-Calendar-Engine.md` §6）

独立包，独立测试目录。覆盖率目标：核心模块 ≥ 90%，全包 ≥ 85%。

### 3.8 视觉回归（不在本 plan，预留）

未来引入 Playwright + Chromatic / Percy。本 plan 仅做 a11y 自动化 + 手动浏览器 smoke。

---

## 4. CI 流水线

### 4.1 后端 CI

```yaml
# .github/workflows/api.yml
- step: checkout
- step: install deps（pip install -e ".[dev]"）
- step: ruff check
- step: mypy（受 known blocker 限制时跑 scoped）
- step: alembic upgrade head
- step: pytest -q --maxfail=1
- step: openapi drift test
```

### 4.2 前端 CI

```yaml
# .github/workflows/web.yml
- step: checkout
- step: npm install
- step: npm run lint:* (9 个 lint 脚本)
- step: tsc --noEmit
- step: vitest --run
- step: vitest --run tests/a11y
- step: vite build
- step: bundle-size-check（vite-bundle-visualizer + 阈值校验）
```

### 4.3 PR 必过项

- 后端 + 前端 CI 全绿
- review gate（≥100 行代码或 ≥50 行文档）
- AGENTS-H8 validation 证据
- AGENTS-H9 commit batch 合规

---

## 5. 测试数据策略

### 5.1 factories

```python
# tests/factories/plan_factory.py
class PlanFactory(factory.Factory):
    class Meta:
        model = PlanV2
    id = factory.Sequence(lambda n: n + 1)
    user_id = factory.SubFactory(UserFactory)
    name = factory.Faker("sentence", nb_words=3, locale="zh_CN")
    target_exam_id = "guokao_2027"
    target_exam_date = factory.LazyFunction(lambda: date.today() + timedelta(days=180))
    daily_minutes_target = 180
    style = "standard"
    baseline = {"xingce_score": 60, "essay_score": 50}
    focus_subjects = ["yanyu", "panduan"]
    status = "active"
    source = "user_manual"
```

### 5.2 fixture 共享

- 后端：conftest.py 提供 `db / client / current_user / factories`
- 前端：tests/handlers/fixtures/*.ts 共享 mock 数据集

### 5.3 数据隔离

每个测试函数独立 transaction（pytest-asyncio + savepoint），跑完 rollback。

---

## 6. 完工 gate（重申，详见各 WU 文档）

### 6.1 后端 M6 完工

- pytest 全绿（unit + integration + invariant + e2e + audit + observability + scheduler）
- alembic upgrade head 干净
- OpenAPI drift 0
- LLM mock provider 跑通所有 prompt
- 真 provider 手动跑通 plan_generate / recommend_today
- coverage 报告：核心模块 ≥ 80%

### 6.2 前端 M12 完工

- vitest 全绿（unit + integration + e2e + a11y）
- tsc strict 0 errors
- 9 lint:* 脚本全过
- bundle 预算未超
- 桌面 + 移动 viewport 都过 e2e
- 暗色模式 smoke
- axe-core 0 violation

---

## 7. 引用矩阵

| 本文档被引用 |
|---|
| 全部其它子文档的"测试"小节 |
| 索引（`./README.md` 验收门槛） |
