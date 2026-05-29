# Requirements Document

> SIK-141 Calendar Aggregation Properties
>
> 本文从零定义 event-scoped aggregation contract，作为 `SIK-141` Wave 0 的 define-first SSOT。
> 上游 SSOT:
> - Notion issue: SIK-141
> - plan: `docs/plan/sik-141-calendar-aggregation-properties-plan.md`
> - visual contract: `docs/plan/sik-141-calendar-aggregation-visual-contract.md`
> - parent spec: `.kiro/specs/sik-138-home-calendar-v2/{requirements.md,design.md}`

## Overview

Home calendar 需要在 month chip / Peek card 上展示事件维度聚合学习数据。这些数据不是 `PlanEventReadV2` 的主字段，而是：

- event 通过 `linkedSessionId` 关联到 session
- session 再衍生出统计指标

本 phase 的目标是定义“如何稳定、批量、显式空态地读取这些聚合值”。

## Requirement 1: Separate Read Boundary

聚合读取必须通过独立 endpoint，而不是把 transport DTO 临时拼在前端。

推荐边界：

- `POST /api/v2/plans/events/aggregates`

禁止：

- 从 `/practice/daily`
- `/practice/mock-exams/history`
- `/practice/stats`
- `/practice/sessions/{id}/result`

直接在前端二次拼 aggregate 值。

## Requirement 2: Batch Request Shape

请求形状固定为：

```ts
interface PlanEventAggregateBatchRequestV2 {
  eventIds: string[];
}
```

约束：

- `eventIds.length` 必须 `1..100`
- 空数组 fail-fast
- 重复 eventId fail-fast
- 前端发送前必须 `dedupe + stable sort(eventIds)`
- response 顺序与请求顺序一致

## Requirement 3: Aggregate Payload Shape

返回项必须稳定包含：

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
```

## Requirement 4: Explicit Availability Semantics

聚合缺失时必须通过 `availability` 显式表达，禁止伪造数字。

必须区分：

- `event_unavailable`
- `missing_linked_session`
- `session_not_found`
- `not_submitted`
- `unsupported_track`
- `no_graded_items`

禁止：

- `accuracy ?? 0`
- `correctCount ?? 0`
- `attemptedCount ?? 0`

## Requirement 5: Metric Definition

指标口径固定为：

- `attemptedCount`
  - 已纳入该 event 统计的已判定题目数
- `correctCount`
  - 上述题目中判对的数量
- `accuracy`
  - `correctCount / attemptedCount`
  - 取值 0..1 decimal
- `activeSeconds`
  - session 真实活跃时长

## Requirement 6: Track Support

V1 只允许 objective session 进入 `ready`：

- 行测练习
- mock exam

essay / subjective tracks 必须明确落：

- `unsupported_track`

补充拍板：

- mixed mock（objective + subjective 混合 session）在 V1 统一视为 `unsupported_track`
- V1 不允许“只对 objective 子集出 partial aggregate”的隐式 partial aggregate

## Requirement 7: Performance Boundary

聚合 endpoint 必须满足：

- 单次请求最多 100 events
- 后端批量查询，不得 per-event N+1
- 前端 month/week 只按 visible events 取数
- peek 复用同一批缓存，不另起 per-event lazy waterfall
- query key 与 request payload 都必须基于同一份排序后的 `eventIds`

## Requirement 8: Ownership

后端 ownership：

- `plans` 模块负责 event aggregate endpoint

前端 ownership：

- `packages/api-client` 负责 types + query hook
- `MonthEventChip` / peek aggregation block 负责渲染

## Requirement 9: Fail-Fast

以下情况必须 fail-fast：

- 空 `eventIds`
- 重复 `eventIds`
- `eventIds.length > 100`

以下情况不得升级为整批 4xx，而是必须按 item 返回 `availability`：

- event 不存在 / 当前用户不可见
- linked session 脏链接
- session 尚未提交
- unsupported track
- no graded items

## Acceptance

- [x] event-scoped aggregate contract defined
- [x] availability enum defined
- [x] metric definitions defined
- [x] performance boundary defined
- [x] independent review complete
