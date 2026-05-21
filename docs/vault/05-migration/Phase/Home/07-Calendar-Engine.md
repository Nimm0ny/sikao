# Phase-Home · 07 · Calendar Engine

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Package**: `packages/calendar-engine/`（新建）
> **决策来源**：`00-Decisions.md` Cal-* 系列

---

## 1. 包定位

### 1.1 职责边界

| 包 | 包含 | 不包含 |
|---|---|---|
| **calendar-engine**（本包） | 时区 / RRULE 展开 / 冲突检测 / 重叠布局 / 拖拽坐标 / view range / 跨日切片 | UI 组件 / React 钩子 / 样式 |
| `packages/ui` | 计算后渲染（EventBlock / Drawer 等） | 业务逻辑 |
| `apps/web/src/components/dashboard-sikao/plan/` | 装配（用 calendar-engine 输出 + ui 组件） | 引擎逻辑 |

calendar-engine 是**纯函数 + 纯类型**，无 React 依赖。所有函数必须可在 Node 测试环境跑（vitest --environment=node）。

### 1.2 依赖

```json
{
  "dependencies": {
    "rrule": "^2.8.1",
    "date-fns": "^3.x",
    "date-fns-tz": "^3.x"
  }
}
```

不依赖 React / dnd-kit / 任何 UI 库。

### 1.3 输出 barrel

```ts
// packages/calendar-engine/src/index.ts
export * from "./types";
export * from "./tz";
export * from "./rrule";
export * from "./conflict";
export * from "./layout";
export * from "./drag";
export * from "./view-range";
export * from "./split";
```

---

## 2. 核心类型（types.ts）

```ts
export interface CalendarEvent {
  id: string;                        // string，因虚拟实例 ID 形如 "100:2026-06-15"
  parentId?: number;
  isRecurringInstance: boolean;
  title: string;
  startAt: string;                   // ISO with offset, e.g. "2026-06-15T09:00:00+08:00"
  endAt: string;                     // ISO with offset
  timezone: string;                  // IANA, e.g. "Asia/Shanghai"
  category: EventCategory;
  source: EventSource;               // user_manual | ai_generated | ai_adjusted
  status: EventStatus;
  targetId?: number;                 // exam_targets 索引
  recurringRule?: string;            // RRULE 字符串
  recurringExceptionDates?: string[];// ISO date list
  notes?: string;
  linkedSessionId?: number | null;
}

export interface PracticeBlock {
  id: string;                        // "session:5023"
  sessionId: number;
  startAt: string;
  endAt: string;
  itemsCount: number;
  accuracy: number;
  category: EventCategory;
  subject: string | null;
  isInProgress: boolean;
}

export type EventCategory = "xingce" | "essay" | "review" | "mock" | "break" | "custom";
export type EventStatus = "planned" | "in_progress" | "done" | "skipped";
export type EventSource = "user_manual" | "ai_generated" | "ai_adjusted";

export type ViewKind = "today" | "week" | "month";

export interface ViewRange {
  kind: ViewKind;
  anchorDate: string;                // YYYY-MM-DD
  fromUtc: string;                   // ISO with offset
  toUtc: string;                     // ISO with offset
  timezone: string;
}

export interface LayoutSlot {
  eventId: string;
  laneIndex: number;                 // 第几路（0-based）
  totalLanes: number;                // 同时段总并列数
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
}

export interface DragSnapResult {
  newStartAt: string;
  newEndAt: string;
  snappedToMinute: number;           // 0 / 15 / 30 / 45
  spanDays: number;
}
```

---

## 3. 模块详细设计

### 3.1 时区（tz.ts）

```ts
import { utcToZonedTime, zonedTimeToUtc, formatInTimeZone } from "date-fns-tz";

export function toZoned(iso: string, tz: string): Date {
  // 输入 ISO with offset → tz 内 wall clock Date
  const utc = parseISO(iso);
  return utcToZonedTime(utc, tz);
}

export function toUtcIso(local: Date, tz: string): string {
  return zonedTimeToUtc(local, tz).toISOString();
}

export function formatLocal(iso: string, tz: string, pattern: string): string {
  return formatInTimeZone(parseISO(iso), tz, pattern);
}

export function dayKey(iso: string, tz: string): string {
  return formatLocal(iso, tz, "yyyy-MM-dd");
}

export function isSameDay(a: string, b: string, tz: string): boolean {
  return dayKey(a, tz) === dayKey(b, tz);
}
```

**DST 处理（Cal-9）**：
- 中国（Asia/Shanghai）无 DST，但工具函数仍走 date-fns-tz，保证未来扩展能用
- 单元测试覆盖 America/New_York 一组 case（2026 年 DST 切换日），保证库函数本身正确
- 业务层不暴露 DST 选项；timezone 字段值如非 IANA 字符串则 throw `InvalidTimezoneError`

---

### 3.2 RRULE（rrule.ts）

#### 3.2.1 子集白名单（与 02-Data-Model §3.5 对齐）

```ts
export const ALLOWED_FREQ = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export const ALLOWED_PARTS = [
  "FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY", "EXDATE",
] as const;

export function validateRRuleSubset(rule: string): { ok: true } | { ok: false; reason: string } {
  // 1. 解析 RRULE 字符串为 part map
  // 2. 检查 FREQ ∈ ALLOWED_FREQ
  // 3. 检查所有 parts ∈ ALLOWED_PARTS（拒绝 BYHOUR / BYMINUTE / SECONDLY / YEARLY）
  // 4. INTERVAL 1-99
  // 5. COUNT 1-365
  // 6. BYDAY 仅 MO/TU/WE/TH/FR/SA/SU
  // 7. BYMONTHDAY 在 -1..31 之间
}
```

#### 3.2.2 展开（expand.ts）

```ts
export interface ExpandOptions {
  master: CalendarEvent;             // 母规则行（含 recurringRule）
  detached: CalendarEvent[];         // detached（同 parentId）
  exceptionDates: string[];          // master.recurringExceptionDates
  rangeFrom: string;                 // ISO with offset
  rangeTo: string;
  timezone: string;
}

export function expandRecurring(opts: ExpandOptions): CalendarEvent[] {
  // 1. parse RRULE，调 rrule.js 的 .between(from, to)
  // 2. 对每个 occurrenceDate：
  //    - 若在 exceptionDates 中：skip
  //    - 否则生成虚拟实例 { id: "${master.id}:${occ.iso_date}", parentId: master.id, isRecurringInstance: true, ... }
  //    - 复制 master 的字段，调整 startAt / endAt 为 occ 所在日
  // 3. 合并 detached：detached 的 startAt 在 [from, to] 内 → 加入结果
  // 4. 排序 by startAt
}
```

#### 3.2.3 测试矩阵（≥18 case）

| Case | RRULE | 预期 |
|---|---|---|
| daily count 7 | `FREQ=DAILY;COUNT=7` | 7 个实例 |
| daily until | `FREQ=DAILY;UNTIL=20260630T000000Z` | 落在 until 前的全部 |
| weekly byday MO/WE/FR | `FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12` | 4 周 × 3 = 12 |
| monthly bymonthday 15 | `FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6` | 6 个月每月 15 |
| monthly bymonthday -1 | `FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3` | 每月最后一天 |
| daily interval 2 | `FREQ=DAILY;INTERVAL=2;COUNT=5` | 隔天 5 次 |
| daily with EXDATE | `FREQ=DAILY;COUNT=10` + EXDATE×2 | 8 个实例 |
| daily + detached override | master + 1 detached | detached 替换 1 个实例 |
| daily + detached at exception | master + EXDATE on D + detached on D | 仅出现 detached |
| range query partial | rule 跨 30 天 + 范围限 7 天 | 7 个实例 |
| BYHOUR 拒绝 | `FREQ=DAILY;BYHOUR=9` | reject |
| YEARLY 拒绝 | `FREQ=YEARLY` | reject |
| INTERVAL 100 拒绝 | `FREQ=DAILY;INTERVAL=100` | reject |
| COUNT 366 拒绝 | `FREQ=DAILY;COUNT=366` | reject |
| BYDAY MX 拒绝 | `FREQ=WEEKLY;BYDAY=MX` | reject |
| weekly until 跨年 | 年初到次年初的 weekly | 正确实例数 |
| daily detached 在 EXDATE 之外 | EXDATE=D1,D2; detached 在 D3 | D3 出现两次（实例 + detached）→ 应 throw 内一致性错误 |
| 跨时区 boundary | tz=Asia/Shanghai vs tz=America/NewYork 同 RRULE | 实例日期一致（ISO），wall clock 不同 |

---

### 3.3 多日事件切片（split.ts，Cal-3）

UI 渲染时 Week/Month 视图需要把跨日事件切成"每日条带"。

```ts
export interface DaySlice {
  dayKey: string;                    // YYYY-MM-DD
  startInDayPx: number;              // Today/Week 用：0-1440
  endInDayPx: number;
  isStart: boolean;                  // 该日是事件起点
  isEnd: boolean;                    // 该日是事件终点
  isContinuation: boolean;
}

export function splitEventByDay(
  event: CalendarEvent,
  range: ViewRange,
  hourPx: number,                    // 默认 60
): DaySlice[] {
  // 把 event [startAt, endAt] 在 range.timezone 下按日切
  // 每天产出一个 DaySlice
  // 第一天 isStart=true，最后一天 isEnd=true，中间 isContinuation=true
}
```

**全天事件（Cal-10）**：
- 不支持独立类型；想做全天就 `00:00 - 23:59`
- splitEventByDay 自然处理
- 视觉特殊渲染（`startInDayPx === 0 && endInDayPx === 1440 - 1` → UI 渲染为顶部固定条带而非时间块）由组件层判断，引擎不关心

---

### 3.4 冲突检测（conflict.ts）

```ts
export interface ConflictPair {
  a: CalendarEvent;
  b: CalendarEvent;
  overlapMinutes: number;
}

export function detectConflicts(
  events: CalendarEvent[],
  proposed: CalendarEvent[],     // 待加入
): ConflictPair[] {
  // O(n log n) 算法：
  // 1. 把 events ∪ proposed 按 startAt 排序
  // 2. 维护 active set（按 endAt 优先队列）
  // 3. 每加入一个新事件，把 endAt < new.startAt 的从 active 弹出
  // 4. active 中剩下的与 new 重叠 → 加入 conflicts
  // 5. 仅返回至少含一个 proposed 的 pair
}
```

**注意**：
- 重复事件需先 expand 再 detect（外部调用方保证）
- 实绩块（PracticeBlock）不参与冲突（视觉重叠允许）

---

### 3.5 重叠布局（layout.ts，Cal-11）

同时段并列 N 路布局算法（"列"算法）：

```ts
export interface LayoutInput {
  events: CalendarEvent[];
  containerWidthPx: number;
  range: ViewRange;
  hourPx: number;
}

export function computeLayoutSlots(input: LayoutInput): LayoutSlot[] {
  // 1. 按 dayKey 分组
  // 2. 对每组：
  //    a. 按 startAt 升序排序
  //    b. 维护 cluster：与前一事件重叠则归同 cluster；否则起新 cluster
  //    c. 每个 cluster 内：贪心分 lane（找最早可用 lane，若无则新增 lane）
  //    d. cluster.totalLanes = 各事件 lane 最大值 + 1
  // 3. 输出 LayoutSlot：
  //    - leftPercent = laneIndex / totalLanes * 100
  //    - widthPercent = 1 / totalLanes * 100 - 0.5（gap）
  //    - topPx / heightPx 由 startAt / endAt 计算
}
```

特殊规则：
- 实绩块（PracticeBlock）单独走一遍 layout，结果叠在事件层之下（z-index 较低）
- 跨日事件在 Week 视图按"每日切片"分别 layout（不会跨列重叠）

---

### 3.6 拖拽坐标（drag.ts，Cal-1 + Cal-7）

```ts
export interface DragInput {
  view: ViewKind;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  hourPx: number;
  containerSize: { widthPx: number; heightPx: number };
  pointerDelta: { dx: number; dy: number };
  originalStartAt: string;
  originalEndAt: string;
  mode: "move" | "resize-top" | "resize-bottom";
  snapMinute: 15;                    // 强制 15 分钟吸附
}

export function computeDragSnap(input: DragInput): DragSnapResult {
  // 1. 把 dx 换算为日数（Week/Month 视图，Today 视图日数=0）
  // 2. 把 dy 换算为分钟数（dy / hourPx * 60）
  // 3. 吸附到 snapMinute（floor 或 round 视 mode 而定）
  // 4. mode=move：start 与 end 同步偏移
  //    mode=resize-bottom：end 偏移
  //    mode=resize-top：start 偏移
  // 5. resize 模式：保证 end > start + 15min（最小时长）
  // 6. 返回新的 startAt / endAt（ISO with offset）
}
```

**跨日拖拽规则**：
- Today 视图禁止跨日（Cal 决策）
- Week 视图允许，dx 跨列即跨日
- Month 视图允许整体拖到另一天，时间保持不变（仅日期改）

---

### 3.7 view range（view-range.ts）

```ts
export function computeViewRange(
  kind: ViewKind,
  anchorDate: string,                // YYYY-MM-DD
  timezone: string,
): ViewRange {
  // today: [anchor 00:00, anchor 24:00) tz 内
  // week: 周一 00:00 ~ 周日 24:00（按周一开始）
  // month: 月初 00:00 ~ 月末 24:00；UI 上常会展示前后几天补齐 6×7 = 42 格
  // 都返回带 timezone 的 ISO with offset
}

export function computeMonthGridRange(
  anchorDate: string,
  timezone: string,
): { gridFrom: string; gridTo: string; cells: 42 } {
  // 月历需要 6 行 × 7 列共 42 格，可能跨上月末和下月初
}
```

---

## 4. 性能与虚拟化

### 4.1 性能预算

| 操作 | 上限 | 触发优化 |
|---|---|---|
| expandRecurring（90 天范围） | 50ms | 否 |
| computeLayoutSlots（500 事件） | 30ms | 否 |
| detectConflicts（500 事件） | 20ms | 否 |
| splitEventByDay（单事件 30 天） | 1ms | 否 |

实测超出预算时优化策略见 §4.2。

### 4.2 虚拟化（Cal-12 月历"+N more" + 大量事件场景）

**Month 视图**：
- 每天最多渲染 3 个事件块（Cal-12）
- 多余 → "+N more"，点开 DayDetailDialog（不影响日历主网格性能）

**Week 视图**：
- 单日同一时段并列 ≥ 5 路时，渲染前 4 路 + "..." 提示
- 引擎层不限制 layoutSlot 数量；UI 层做 cap

**RRULE 远期展开懒加载**：
- 范围查询限制 ≤ 90 天（API 层 + 引擎层双校验）
- UI 切到下一区间时再次拉取 + 重 expand

### 4.3 不引入虚拟滚动

5 tab Web 设计下首页只显示一个视图（Today/Week/Month 之一），事件量在 90 天范围内 ≤ 500 是常态。不引入 react-virtual 等库，避免引擎包膨胀。

---

## 5. 错误处理（fail-fast，AGENTS-H7）

| 错误类型 | 抛出 |
|---|---|
| RRULE 不合法 | `RRuleSubsetViolation`（含 reason） |
| timezone 非 IANA | `InvalidTimezoneError` |
| 范围过大（>90 天） | `RangeTooLargeError` |
| 拖拽坐标越界 | `DragBoundsError` |
| event endAt <= startAt | `InvalidEventTimeError` |

不静默吞错，不返回 null/undefined 默认值。调用方负责捕获并展示 UI 错误。

---

## 6. 测试策略

### 6.1 单元测试

每个文件配 `__tests__/<file>.test.ts`：

| 文件 | 覆盖率目标 | 关键 case |
|---|---|---|
| tz.ts | 95% | 无 DST 中国时区 + 含 DST 美东时区 |
| rrule.ts | 95% | §3.2.3 矩阵 18+ case |
| split.ts | 90% | 跨日 / 全天 / 单日 |
| conflict.ts | 90% | O(n log n) 性能 + 边界（同秒重叠 / 邻接不重叠） |
| layout.ts | 90% | 1 路 / 2 路 / 5 路 / 嵌套 cluster |
| drag.ts | 95% | 吸附 / resize 最小 / 跨日 / pixel→time |
| view-range.ts | 95% | 月初月末 / 周一边界 / 月历 42 格 |

### 6.2 性能测试

```ts
// __tests__/perf/expand.bench.ts
bench("expandRecurring 90d daily", () => {
  expandRecurring({ ...master, range: 90d });
}).limit(50);

// 失败时 CI 警告但不阻塞
```

### 6.3 集成测试

apps/web 内 e2e 测试调引擎 + UI 联合（详见 `10-Testing.md`）。

---

## 7. 引用矩阵

| 本文档被引用 |
|---|
| `04-Frontend-WU.md` WU-F3 / WU-F4 实现按本文 |
| `02-Data-Model.md` §3.5 RRULE subset 与本文 §3.2.1 一致 |
| `08-NonFunctional.md` §性能预算 引用本文 §4.1 |
| `10-Testing.md` 引用本文 §6 |
