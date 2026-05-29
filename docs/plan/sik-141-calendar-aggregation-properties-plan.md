---
type: feature
status: active
owner: lhr
last-reviewed: 2026-05-30
notion-issue-url: https://www.notion.so/36fbc174f6c8816e8108f53a93765ebc
notion-issue-identifier: SIK-141
parent-issue: SIK-138
parent-issue-url: https://www.notion.so/36ebc174f6c88187840ac2623a1666f7
spec: .kiro/specs/sik-141-calendar-aggregation-properties/
depends-on: SIK-138, SIK-139, SIK-140
related: SIK-112, SIK-139, SIK-140
---

# Calendar Aggregation Properties Plan

> Define-First 文档。当前波次只定义跨服务聚合契约、性能边界、空值语义和视觉通道，不进入实现。

## 1. Why / 目标

`SIK-141` 要在 Home calendar 的 month chip / Peek card 上展示事件维度聚合学习数据，至少覆盖：

- 练习量
- 正确数
- 正确率
- 用时

当前系统虽然已经把 `linkedSessionId` 挂到了 `PlanEventReadV2` 上，但只有“事件关联了哪条 session”的信息，没有一条稳定、批量、event-scoped 的聚合读取链。因此本 issue 的 W0 目标不是“先把数字渲染出来”，而是把后续实现所依赖的跨服务聚合契约一次性定义清楚。

## 2. Current-State Evidence

### 2.1 `PlanEventReadV2` 只有链接，没有聚合

当前 `PlanEventReadV2` 只有：

- `id`
- `title`
- `category`
- `status`
- `linkedSessionId`
- `targetId`
- 其他计划事件字段

没有任何聚合子对象。证据：

- `packages/api-client/src/types/api.generated.ts`
- `services/api/src/sikao_api/modules/plans/application/helpers.py` `serialize_event(...)`

### 2.2 现有统计 DTO 都不是 event-scoped

现有几个看起来“像能复用”的 DTO，其实都不满足 event 维度聚合：

1. `DailyPracticeResponseV2`
   - 只有 `questionCount`、`completedAccuracy`、`completedSessionId`
   - scope 是“某天每日一练卡片”
   - 没有 `correctCount` / `activeSeconds`

2. `MockExamHistoryItem`
   - 有 `accuracy`、`actualActiveSeconds`
   - 但没有 `correctCount`
   - scope 是 mock 历史列表，不是 event batch

3. `PracticeStatsCellV2`
   - 有 `totalQuestions`、`correctCount`、`accuracy`、`totalMinutes`
   - 但 scope 是 `type/category` 聚合，不是 linked session 聚合

4. `PracticeSessionResultResponseV2`
   - 只有 `summary[] / sections[] / actions[]`
   - 是结果页展示 DTO，不是稳定 typed aggregate contract

这意味着 `SIK-141` 不能靠拼这些现成 transport DTO 混过去，必须定义新的 canonical aggregate surface。

### 2.3 现有路由没有 event/session aggregate 批量入口

当前相关路由：

- `GET /api/v2/plans/events`
- `GET /api/v2/practice/daily`
- `GET /api/v2/practice/mock-exams/history`
- `GET /api/v2/practice/stats*`
- `GET /api/v2/practice/sessions/{session_id}/result`

没有一个 endpoint 能按“多个 eventId / linkedSessionId”批量返回统一聚合指标。

## 3. W0 Decisions

### 3.1 推荐方案：独立 batch aggregate endpoint

W0 拍板：**不扩展 `PlanEventReadV2` 本体字段**，而是新增独立只读聚合接口：

`POST /api/v2/plans/events/aggregates`

理由：

1. `plans/events` 当前是 Home calendar 的 canonical event window query。
   - 继续往 `PlanEventReadV2` 塞聚合，意味着所有事件窗口请求都要承担额外 join / batch 代价。

2. aggregation 是“派生读取”，不是事件主实体字段。
   - 和 `title / status / startAt` 这种 primary event fields 不是同一层。

3. month / week / peek 对聚合的取数时机不同。
   - month/week 更适合批量拿 visible events
   - peek 复用同一批缓存

4. 聚合缺失需要显式 availability 语义。
   - 把这种 fail-fast / nullability 规则塞进 `PlanEventReadV2` 会污染主 DTO。

### 3.2 请求与响应形状

#### Request

```ts
interface PlanEventAggregateBatchRequestV2 {
  eventIds: string[];
}
```

约束：

- `eventIds.length` 必须 `1..100`
- 空数组 422 fail-fast
- 重复 `eventIds` 422 fail-fast
- 前端 query hook 在发送前必须对 `eventIds` 做 `dedupe + stable sort`
- 后端必须按输入顺序返回 `items`

#### Canonical ordering

为了避免“同一集合不同顺序命中同一个 query key，却缓存不同顺序 `items[]`”的错配，W0 锁定：

- 前端 `useEventAggregates(...)` 必须先 `dedupe + stable sort(eventIds)` 再发送 request
- 后端 response 继续保持“按输入顺序返回”
- 前端消费端不得按数组位置盲对齐，必须先重建 `eventId -> aggregate` 索引

#### Response

```ts
type PlanEventAggregateAvailabilityV2 =
  | "ready"
  | "event_unavailable"
  | "missing_linked_session"
  | "session_not_found"
  | "not_submitted"
  | "unsupported_track"
  | "no_graded_items";

interface PlanEventAggregateMetricsV2 {
  attemptedCount: number;
  correctCount: number;
  accuracy: number;
  activeSeconds: number | null;
  sourceKind: "practice_session" | "mock_exam";
}

interface PlanEventAggregateReadV2 {
  eventId: string;
  linkedSessionId: number | null;
  availability: PlanEventAggregateAvailabilityV2;
  metrics: PlanEventAggregateMetricsV2 | null;
}

interface PlanEventAggregateBatchResponseV2 {
  items: PlanEventAggregateReadV2[];
}
```

### 3.3 口径定义

`metrics` 的字段口径锁定如下：

- `attemptedCount`
  - 该 linked session 中纳入统计的已判定题目数
- `correctCount`
  - 上述题目里判对的数量
- `accuracy`
  - `correctCount / attemptedCount`
  - 使用 0..1 decimal，和 `practice_stats` 保持同一语义
- `activeSeconds`
  - session 真实活跃用时
  - 如后端现有 session 模型无稳定值则允许 `null`

### 3.4 track 支持范围

W0 拍板：**首版只把 objective scoring session 纳入 `ready`**，包括：

- 行测练习 session
- mock exam session

显式不伪装支持：

- essay / subjective tracks
- 尚未提交的 session
- 找不到 session 的脏链接
- mixed mock（同一 linked session 同时含 objective + subjective items）

对应 availability：

- `event_unavailable`
- `missing_linked_session`
- `session_not_found`
- `not_submitted`
- `unsupported_track`
- `no_graded_items`

补充拍板：

- mixed mock 在 V1 统一落 `unsupported_track`
- V1 不允许“只对 objective 子集给出 partial aggregate”的隐式行为

前端必须按 availability 渲染空态，不允许：

- `?? 0`
- `0%` 伪造
- `0 / 0` 伪造

## 4. Backend Contract

### 4.1 推荐后端落点

建议后端新增 `plans` 模块下的聚合只读子路由：

- route: `services/api/src/sikao_api/modules/plans/interface/routes.py`
- application service:
  - `services/api/src/sikao_api/modules/plans/application/event_aggregate_service.py`
- schema:
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `packages/api-client/src/types/*` regenerated from OpenAPI

理由：

- 消费方是 calendar event
- ownership 应挂在 `plans/events` 下
- 避免把 `practice_stats` 的 type/category 聚合职责拉歪成 event 聚合

### 4.2 聚合数据源

推荐读取链：

`PlanEventV2.linked_session_id -> PracticeSessionV2 -> PracticeSessionAnswerV2 / result facts`

禁止 W1 直接调用这些现有 transport endpoint 再二次拼装：

- `/practice/daily`
- `/practice/mock-exams/history`
- `/practice/stats`
- `/practice/sessions/{id}/result`

因为它们的语义层次、字段口径和批量能力都不稳定。

### 4.3 性能边界

W0 锁定：

- 单次 batch 最多 100 个 `eventIds`
- 后端必须批量拿 event / session / answer facts，禁止 per-event N+1
- month/week 视图只允许按当前 visible events 取数，不允许 per-chip lazy waterfall
- 前端 query key 与 request payload 都必须基于同一份排序后 `eventIds` 生成，确保缓存命中与响应顺序一致

## 5. Frontend Read Contract

W0 只定义未来接线面：

- `packages/api-client`
  - `PlanEventAggregate*V2` types
  - `fetchEventAggregates(...)`
  - `useEventAggregates(...)`
- `apps/web/src/views/Home/sections/`
  - `MonthEventChip`
  - peek aggregation block（建议新建 `CalendarPeekAggregation.tsx`）

禁止在 component 内直接读取其他 unrelated query：

- `dailyPracticeQueries`
- `mockExamQueries`
- `practiceStatsQueries`

calendar aggregation 只能走新的 aggregate query hook。

## 6. Visual Contract Requirement

虽然这轮不进入实现，但后续属于明确视觉改动，按 H11 先落：

- `docs/plan/sik-141-calendar-aggregation-visual-contract.md`

W0 先把：

- chip aggregation channel
- peek aggregation block
- availability empty state
- token 映射

定义清楚。

## 7. Acceptance Mapping

本轮 W0 只覆盖 issue 的前两项 acceptance：

- [x] Wave 0 聚合契约定义落档（数据源 / 端点 DTO / 性能边界 / 空值语义）
- [x] 跨服务契约独立 review（H5/H6）

本轮不覆盖：

- api-client 实现
- 渲染实现
- 性能验证
- 浏览器截图验收

## 8. Rollback

W0 全是 define-first 文档。

如需回退：

- `git revert` W0 define-first commits

无 runtime 影响。

## 9. Next Owner

- Wave 1 Runner:
  - 落 `api-client` types + query hook
  - 后端新增 aggregate batch endpoint
- Wave 2 Runner:
  - chip / peek 渲染
- Wave 3 Verifier:
  - 性能预算
  - 1440 / 1920 验收
