# Phase-Review · 11 · Testing

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[01-Boundary-Rules](./01-Boundary-Rules.md) · [05-SRS-Engine](./05-SRS-Engine.md) §8 · [10-NonFunctional](./10-NonFunctional.md)

---

## 1. 测试金字塔

```
              ╱╲
             ╱  ╲
            ╱ E2E╲          ← 端到端集成（pytest e2e / vitest e2e）
           ╱──────╲            少量，验证跨模块 / 跨 tab 全流程
          ╱        ╲
         ╱Integration╲      ← 集成测试（API 端点 + DB + Mock LLM）
        ╱──────────────╲       中量，验证端点完整行为
       ╱                ╲
      ╱   Unit Tests     ╲  ← 单元测试（SRS engine / validators / hooks / domain hooks）
     ╱────────────────────╲    大量，快速反馈
    ╱                      ╲
   ╱    Static Analysis     ╲← TypeScript strict / mypy / lint
  ╱──────────────────────────╲  门禁级别
```

---

## 2. 后端 Invariant 测试（7 条 PR-R 边界规则）

文件位置：`tests/api/e2e/test_review_invariants.py`

| 规则 | 测试场景 | 断言 |
|---|---|---|
| **PR-R1** 入队多源 | 同题创建 wrong_answer + manual_add 两行 | 两行共存，id 不同 |
| **PR-R1** 去重 | manual_add 已存在 active 行时再创建 | HTTP 409 |
| **PR-R2** source_kind 不可变 | PATCH item 尝试改 source_kind | HTTP 422 或字段被忽略 |
| **PR-R3** 已下线题可重做 | is_active=false 的题创建 redo session | 成功创建 |
| **PR-R4** 强制 per_question | 创建 review session 传 practice_mode=closed_book | 实际 mode=per_question |
| **PR-R5** graduated 后再错 | graduated 题答错 | 新行 source_kind=re_failed + 原行不变 |
| **PR-R6** AI 失败不阻塞 | mock LLM 超时 → list items | list 正常返回 |
| **PR-R7** question_id 互斥 | note_card 不带 source_note_id | HTTP 422 |

---

## 3. SRS 状态机测试（12 场景）

文件位置：`tests/api/modules/review/test_srs_engine.py`

| # | 场景 | 初始 | 操作 | 期望 |
|---|---|---|---|---|
| T1 | 新题首次答对 | pending, streak=0 | advance | in_progress, streak=1, next=+3d |
| T2 | 新题首次答错 | pending, streak=0 | regress | in_progress, streak=0, next=+1d |
| T3 | streak=1 答对 → 毕业 | in_progress, streak=1 | advance | graduated, streak=2, next=None |
| T4 | streak=1 答错 | in_progress, streak=1 | regress | in_progress, streak=0, next=+1d |
| T5 | 毕业确认 | streak=2 | check_graduation | True |
| T6 | re_failed 首次答对 | pending(re_failed), streak=0 | advance | in_progress, streak=1, next=+3d |
| T7 | re_failed 连续毕业 | pending(re_failed) | advance × 2 | graduated |
| T8 | 费曼加成 streak=0 | pending, streak=0 | advance(recall=True) | streak=1, next=+6d |
| T9 | 费曼加成 streak=1 | in_progress, streak=1 | advance(recall=True) | graduated |
| T10 | 时区 UTC+8 | — | compute(tz=Asia/Shanghai) | 基于 CST today_end |
| T11 | 时区空值 | — | compute(tz=None) | fallback Asia/Shanghai |
| T12 | streak=0 答错 | in_progress, streak=0 | regress | streak=0 不变, next=+1d |

---

## 4. 跨 Tab 集成测试

文件位置：`tests/api/e2e/test_cross_tab_review.py`

| # | 场景 | 流程 | 断言 |
|---|---|---|---|
| CT1 | Practice 答错 → Review 可见 | 创建 session → 答错 → commit → list review items | 新行 source_kind=wrong_answer |
| CT2 | Practice Flag → Review 可见 | 创建 session → flag → commit → list review items | 新行 source_kind=flagged_persistent |
| CT3 | Graduated 后再错 | graduate item → 新 session 答错 → commit | 新行 source_kind=re_failed + 原行不变 |
| CT4 | Review → Home today | 创建 item(next_review_at=today) → GET home today | 复盘条目在 today list |
| CT5 | Review 加入计划 | POST add-to-plan → GET recommendations | type=review_session |
| CT6 | Review 保存为笔记 | POST cause-analysis → save-as-note → GET notes | NoteV2 type=ai_cause_analysis |

---

## 5. 前端单元测试

### 5.1 Domain Hooks 测试

文件位置：`packages/domain/src/review/__tests__/`

| Hook | 测试场景 |
|---|---|
| `useReviewItems` | 筛选/排序参数正确传递；分页翻页；空状态 |
| `useReviewItem` | 正常加载；404 处理；staleTime 验证 |
| `useReviewToday` | due 条目过滤；空队列 |
| `useSmartReviewCards` | 12 场景（见 07-Smart-Review-Aggregation §9） |
| `useRecentAnswers` | limit=200 参数正确；空数组 |
| `useCauseAnalysis` | 缓存命中标识；loading state；error state |
| `useWeeklyReview` | 数据聚合正确；空周 |
| `useQuestionHub` | 5 种 ctx 解析；缺少参数时 fallback |

### 5.2 Smart Card Aggregation 测试

文件位置：`packages/domain/src/review/__tests__/useSmartReviewCards.test.ts`

12 场景全覆盖（见 [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md) §9）。
- 每场景独立 test case
- Mock data factory：`createMockReviewItem()` / `createMockAnswer()`
- 边界：items < 5 → empty / 超 20 截断 / 时间窗口边界

### 5.3 Context Parsing 测试

文件位置：`apps/web/src/views/__tests__/QuestionHub.test.tsx`

| 场景 | 输入 | 期望 |
|---|---|---|
| ctx=practice | `?ctx=practice&session_id=42` | source=practice, sessionId=42 |
| ctx=review | `?ctx=review&review_id=7` | source=review, reviewId=7 |
| ctx=note | `?ctx=note&note_id=3` | source=note, noteId=3 |
| 缺少 ctx | 无参数 | source=review (default) |
| 非法 ctx | `?ctx=invalid` | source=review (fallback) |

---

## 6. 前端 E2E 测试

文件位置：`apps/web/src/__tests__/e2e/`

### 6.1 Happy Path

```
/review
  → 页面加载 → 周回顾条可见
  → SRS 队列展示 due 条目
  → 点击条目 → /q/:id?ctx=review
  → Q-Hub 页面加载 → 题面 + 操作按钮
  → 点击"去重做" → /q/:id/redo
  → 重做 session 创建 → 答对 → 费曼输入 → 提交
  → 返回 Q-Hub → 状态更新（streak +1）
  → 再次答对 → graduated
  → 返回 /review → 条目消失（已毕业）
```

### 6.2 Route Redirect 测试

| 旧路由 | 期望跳转 |
|---|---|
| `/wrong-book` | `/review` |
| `/wrong-book/smart-review` | `/review` |
| `/wrong-book/123` | `/q/123?ctx=review&review_id=...` |
| `/wrong-book/123/redo` | `/q/123/redo?ctx=review&review_id=...` |
| `/practice/questions/456` | `/q/456?ctx=practice` |
| `/review/items/789` | `/q/{question_id}?ctx=review&review_id=789` |

### 6.3 Cross-Ctx Navigation

| 起点 | 操作 | 终点 |
|---|---|---|
| Practice result → 点错题 | 跳转 | `/q/:id?ctx=practice&session_id=N` |
| Review list → 点条目 | 跳转 | `/q/:id?ctx=review&review_id=N` |
| Notes detail → 点关联题 | 跳转 | `/q/:id?ctx=note&note_id=N` |
| Home 弱项卡 → 点具体题 | 跳转 | `/q/:id?ctx=home` |
| Favorites → 点题 | 跳转 | `/q/:id?ctx=favorite` |

---

## 7. 无障碍测试（A11y）

文件位置：`apps/web/src/__tests__/a11y/review-a11y.test.tsx`

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

const REVIEW_VIEWS = [
  { path: '/review', name: 'ReviewToday' },
  { path: '/review/all', name: 'ReviewAll' },
  { path: '/review/insights', name: 'ReviewInsights' },
  { path: '/q/1', name: 'QuestionHub' },
];

REVIEW_VIEWS.forEach(({ path, name }) => {
  test(`${name} has no a11y violations`, async () => {
    const { container } = render(<App initialRoute={path} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

覆盖检查：
- 标题层级连续（h1 → h2 → h3，无跳级）
- 可交互元素有 accessible name
- 颜色对比度 ≥ 4.5:1
- 折叠区块 aria-expanded 正确
- loading 状态有 aria-busy
- Toast / alert 有 role="alert"

---

## 8. 性能 Smoke 测试

文件位置：`apps/web/src/__tests__/performance/review-performance.test.tsx`

| 场景 | 目标 | 实现 |
|---|---|---|
| 500 items 列表渲染 | < 1s 到 interactive | Mock 500 条 → render → measure DOM ready |
| 三卡聚合 500 items + 200 answers | < 50ms | performance.now() 包裹 computeCards |
| Q-Hub 页面首次渲染 | < 500ms | Mock 完整数据 → render → measure |

---

## 9. Gate 标准（完工条件）

### 9.1 后端 Gate（M6 完工）

- [ ] `pytest` 全绿（含 invariant / e2e / SRS / cross-tab / audit）
- [ ] `alembic upgrade head` + `alembic downgrade -1` 往返干净
- [ ] OpenAPI drift test 0 diff
- [ ] LLM mock provider 全流程通过
- [ ] 限流测试：21 次请求 → 第 21 次 429
- [ ] 性能 benchmark：list 500 items < 200ms
- [ ] mypy strict 0 errors（review 模块）
- [ ] 代码覆盖率 ≥ 85%（review 模块）

### 9.2 前端 Gate（M14 完工）

- [ ] `vitest --run` 全绿（含 e2e + a11y + performance smoke）
- [ ] `tsc --strict` 0 errors
- [ ] 9 条 lint:* 脚本全过
- [ ] Bundle 预算：review 总 chunk < 80KB gzipped
- [ ] axe-core：0 violations（全部 review 视图）
- [ ] 桌面 viewport (1280×800) e2e 全过
- [ ] 移动 viewport (375×667) e2e 全过
- [ ] 暗色模式 smoke 手动验证
- [ ] `/wrong-book/*` 全族 redirect 测试覆盖
- [ ] `/practice/questions/*` redirect 测试覆盖
- [ ] `/review/items/*` redirect 测试覆盖
- [ ] 三卡算法 12 场景全绿

### 9.3 整体 Gate

- [ ] 后端 + 前端 Gate 全过
- [ ] 跨 tab 集成测试全绿（CT1 ~ CT6）
- [ ] Q-Hub 5 种 ctx 导航全绿
- [ ] 无 console.error 残留（AGENTS H4.4）
- [ ] PR description 标注"已读 A0 §X.Y"

---

## 10. 测试工具与配置

| 工具 | 用途 | 配置位置 |
|---|---|---|
| pytest | 后端单元 + 集成 + e2e | `services/api/pyproject.toml [tool.pytest]` |
| pytest-benchmark | 后端性能 | 同上 |
| vitest | 前端单元 + e2e | `apps/web/vitest.config.ts` |
| @testing-library/react | 组件渲染测试 | — |
| MSW (Mock Service Worker) | API mock | `apps/web/src/test-utils/handlers/` |
| jest-axe | 无障碍检测 | — |
| axe-core | 底层引擎 | — |

### 10.1 Mock Data Factories

```python
# tests/api/factories.py（追加）
def create_review_item(
    user_id: int,
    source_kind: str = "wrong_answer",
    status: str = "pending",
    correct_streak: int = 0,
    question_id: int | None = None,
    **kwargs,
) -> ReviewItemV2: ...

def create_review_attempt(
    review_item_id: int,
    outcome: str = "correct",
    **kwargs,
) -> ReviewAttemptV2: ...

def create_cause_analysis(
    user_id: int,
    scope: str = "single",
    **kwargs,
) -> AiCauseAnalysisV2: ...
```

```typescript
// apps/web/src/test-utils/factories/review.ts（新建）
export function createMockReviewItem(overrides?: Partial<ReviewItemResponseV2>): ReviewItemResponseV2;
export function createMockAnswer(overrides?: Partial<RecentAnswer>): RecentAnswer;
export function createMockCauseAnalysis(overrides?: Partial<CauseAnalysisResponseV2>): CauseAnalysisResponseV2;
```

---

## 引用矩阵

| 本文被引用 |
|---|
| [README.md](./README.md) §8 完工门槛 |
| [03-Backend-WU](./03-Backend-WU.md) WU-R12 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR12 |
