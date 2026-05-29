# Design Document

> SIK-141 Calendar Aggregation Properties
>
> 锁定后端读边界、availability 状态机、以及 chip / peek 未来消费模型。

## Overview

`SIK-141` 不是“往 PlanEventReadV2 上加几个 nullable 数字”。它是一个独立的 event-scoped aggregation read model：

```text
PlanEventV2
  -> linked_session_id
  -> PracticeSessionV2
  -> answer/result facts
  -> aggregate metrics
```

## Read Model

推荐接口：

```text
POST /api/v2/plans/events/aggregates
```

### Why Not Extend `PlanEventReadV2`

不推荐把聚合直接并入 `PlanEventReadV2`，因为：

1. `plans/events` 是 Home calendar 的 canonical event window query
2. aggregation 是派生数据，不是 event 主字段
3. month/week/peek 的取数频率与 event window 不同
4. availability empty states 会污染 event 主 DTO

## DTO Design

### Request

```ts
interface PlanEventAggregateBatchRequestV2 {
  eventIds: string[];
}
```

Consumer invariant:

- 前端 query hook 必须先 `dedupe + stable sort(eventIds)` 再发送
- response 保持输入顺序
- UI 层按 `eventId` 建索引消费，不按数组位置盲对齐

### Response

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

## Availability State Machine

```text
event has no linkedSessionId
  -> missing_linked_session

event is not found or not visible to current user
  -> event_unavailable

event linkedSessionId points nowhere
  -> session_not_found

session exists but not submitted
  -> not_submitted

session submitted but unsupported track
  -> unsupported_track

session supported but no graded items
  -> no_graded_items

session supported + graded
  -> ready(metrics)
```

补充拍板：

- mixed mock 统一落 `unsupported_track`
- 不做“只统计 objective 子集”的 partial aggregate

## Data Sources

### Allowed

- `PlanEventV2.linked_session_id`
- `PracticeSessionV2`
- answer/result facts behind submitted practice sessions

### Rejected as Canonical Aggregate Source

- `DailyPracticeResponseV2`
  - per-day card DTO, not event batch
- `MockExamHistoryItem`
  - history list DTO, lacks correctCount
- `PracticeStatsCellV2`
  - category/type aggregate, not session aggregate
- `PracticeSessionResultResponseV2`
  - UI result payload, not stable typed aggregate model

## Frontend Consumption

### api-client

Future Wave 1 should add:

- `PlanEventAggregate*V2` types
- `fetchEventAggregates(payload)`
- `useEventAggregates(eventIds)`

### View Ownership

- `MonthEventChip`
  - compact aggregate line / availability placeholder
- new `CalendarPeekAggregation.tsx` (recommended)
  - expanded aggregate block in peek

## Performance Strategy

### Backend

- batch load events by ids
- batch resolve sessions
- batch compute metrics
- preserve request order on output
- reject `eventIds.length > 100`

### Frontend

- derive visible event ids from current month/week window
- query once per visible window
- sort ids inside query key and request payload for cache stability + response order determinism
- peek reuses same cache instead of fetching single event aggregates

## Error / Empty Rendering Contract

Frontend rendering must branch on `availability` first:

- `ready`
  - render aggregate values
- `event_unavailable`
  - render explicit `事件不可用`
- `missing_linked_session`
  - render explicit `未关联`
- `session_not_found`
  - render explicit `关联失效`
- `not_submitted`
  - render explicit `未提交`
- `unsupported_track`
  - render explicit `暂不支持`
- `no_graded_items`
  - render explicit `无判题数据`

No numeric placeholder is allowed for non-ready states.

## Test Strategy

Future waves should cover:

- request validation (`[]`, duplicates, >100)
- availability mapping for each state
- ready metrics for xingce / mock
- unsupported essay / mixed mock
- month visible batch query reuse
- peek cache reuse without extra waterfall
