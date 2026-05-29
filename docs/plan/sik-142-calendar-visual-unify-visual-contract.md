---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-29
notion-issue-url: https://www.notion.so/36fbc174f6c88157b064e4f1939b2e71
notion-issue-identifier: SIK-142
parent-issue: SIK-138 (Calendar Notion-like V2, Done)
prototype-baseline: .tmp_review/out/Tab1-Home/Home v2.1.html
token-derivation-approved-by: lhr (2026-05-29)
chip-color-semantic-approved-by: lhr (2026-05-29)
---

# SIK-142 Calendar 视觉统一 + 三周布局收敛 视觉契约 (H11)

> H11 Define-First 视觉契约。本 issue 在 SIK-138（Calendar V2）/ SIK-139（拖拽 Phase 3/4）
> 之上收敛 Home 日历的视觉与布局债：chip 配色语义统一、月视图 3 周 rolling window、
> 单元格 ≤3 条格内滑动、删今日视图、周视图接只读 Peek。
>
> **视觉 SSOT** = 原型 `.tmp_review/out/Tab1-Home/Home v2.1.html`。
> **token SSOT** = `packages/design-system/src/tokens.css` §8 + `docs/vault/04-design/Prototype-Token-Map.md`。
> **布局 SSOT** = `docs/vault/04-design/Web-Layout.md`（一屏锁死）+ `Design-System.md`。
>
> 核心主动偏离（lhr 2026-05-29 拍板）：chip 颜色语义从原型的 **kind 配色** 改为
> **时间完成状态配色**（done/skipped/overdue/today/future），kind 降级为中性 leading 图标。
> 见 §5 SSOT Conflicts + §6 Visual Drift。契约不在不得开 Runner（H11）。

## 0. Scope 分层（5 wave）

| Wave | 可见视觉变化 | 契约约束来源 |
|---|---|---|
| Wave 0 | 无（仅落本契约文档） | 全节 Define-First |
| Wave 1 | chip 时间状态配色 + kind 中性图标 + done 勾 + 通道收敛（source/link/target 移出 chip） | §3 §4 §5 §6 |
| Wave 2 | 月视图 3 周 rolling window + 无滚动 + ±3 周翻页 | §1 §6 |
| Wave 3 | 月+周单元格 ≤3 条 + 格内滑动无滚动条 + 去 `+N 更多` | §1 §2 §3 |
| Wave 4 | 删 today 视图 + 类型收窄 `'week'|'month'` + 去 countdown chip | §1 §2 §5 |
| Wave 5 | 周视图 chip 可点 → 只读 Peek + Peek V5 对齐 | §2 §3 §4 |

> 边界（H1）：W5 只接**现有只读 Peek**；真正的 inline 编辑（title/notes/props）是 SIK-140
> 范围，W5 不做。拖拽核心编排（`rescheduleEvent` / `resolveCalendarDrop` /
> `commitReschedule` / `conflictGuard` / `runConflictGate` / `ConflictConfirmDialog`）
> 属 SIK-139，本 issue 只动视觉/布局/视图增删，有接缝时只碰接缝。

## 1. Layout Topology

日历挂在 `CalendarPanel`（Home Section A 单 Panel），内部 `CalendarBody` 按 view 分发。
一屏锁死沿用 SIK-126/138：Home 入口 view 由 `ScreenLockShell` 锁死，日历 body 局部滚或锁死。

### 1.1 月视图（W2 收敛目标）

- root：`MonthCalendarView` → `gridRoot[role=grid]` → `dowRow`（星期表头，sticky）+ `bodyScroll` → `gridBody[role=rowgroup]` → 每周 `gridRow[role=row]` → `cell[role=gridcell]`。
- **现状**：`buildMonthCells` 产 `6 周 × 7 = 42 格`（整月 + 补齐），`bodyScroll` 局部纵向滚（约 3 行视口）。
- **W2 目标**（对齐原型 `.calendar.view-month`，HTML L857-915 + renderMonth JS L1789-1815）：
  - cell 数 `42 → 21`（**本周一起往下 3 周**，rolling window，非整月）。
  - grid 行：`grid-template-rows: repeat(3, minmax(0, 1fr))` + `overflow: hidden`（**不滚动**，3 行刚好占满）。
  - 窗口锚点 = `startOfWeek(anchor)`（本周一，Monday-first）；prev/next = **±3 周翻页**（见 §2）。
  - 行为：每行自然伸展让 chip 配色读得清（原型注释 "Lets each row breathe"）。
- 子区域 owner：
  - `MonthCalendarViewBody` — 数据 / config / store 订阅（W2 改 window/cells 构造）。
  - `MonthGrid` / `MonthGridDnd` — cell 渲染 + peek list scope + droppable（W2 改 grid CSS；不碰 dnd 编排）。
  - `MonthEventChip` — chip 表面（W1 改配色/通道；不碰 drag handle 接线）。

### 1.2 周视图（W1 视觉统一 / W5 接 Peek）

- root：`WeekCalendarView` → `root`（flex col, overflow hidden）→ `calHead`（7 列星期）+ `calBody`（`7 列 × 3 行` morning/noon/evening，`repeat(3, minmax(0,1fr))`）。
- 一屏行为：`root` 锁死（`flex:1 + min-height:0 + overflow:hidden`），不整页滚。
- **现状**：周 chip 是 `.dayEvent` 纯 `<span>`（不可点），配色按 `data-kind` 硬选择器（plan/practice/mock/milestone）。
- **W1 目标**：周 chip 改复用 `MonthEventChip` 同组件（统一几何/配色/通道）；不传 `drag` prop 即无拖拽；不传 `onClick` 即只读。
- **W5 目标**：周 chip 接 `onClick` → 复用 `CalendarPeekProvider` / `CalendarPeekCard`（只读）。

### 1.3 today 视图（W4 删除）

- **现状**：`TodayCalendarView` = 24 小时横向滚动条（原型 `.calendar.view-today`，隐藏滚动条模式）。
- **W4 目标**：整组删除（`.tsx` + `.module.css` + `.test.tsx`）；视图集合收窄为 `'week' | 'month'`。
- store 默认 `currentView` 已是 `'week'`（`usePlanStore.ts:45`），无需改默认；persisted 旧 `'today'` 值需显式归一到 `'week'`（§5 / H7）。

### 1.4 一屏锁死不变量（Web-Layout）

- 本 issue **不改** Home root grid 行列分配与 `ScreenLockShell` 包裹关系。
- 月视图从「局部滚 3 行」改为「锁死 3 周无滚动」是**收紧**一屏行为（更符合一屏锁死），不引入新滚动容器。
- 格内 ≤3 条溢出滑动（W3）是 **cell 内局部滚动**（隐藏滚动条），不破坏 Panel/grid 外层锁死。

## 2. Required Interactive Elements

逐块列必须存在的控件（不能少）。标 `defer to W<N>` 的是原型有但本 wave 不做。

### 2.1 CalendarPanel head（左 segment + 右 actions）

- **视图 segment**（`Tabs variant=segmented`）：
  - 现状 3 项 `[今日 / 本周 / 本月]`（key `today/week/month`）。
  - **W4 收窄为 2 项** `[本周 / 本月]`（key `week/month`）；移除 `今日`。
- **prev 按钮**（`◀`，`aria-label` 随 view）：月视图 W2 改语义为「上 3 周」。
- **today 按钮**（`○`，`aria-label=回到今天`）：保留。
- **next 按钮**（`▶`）：月视图 W2 改语义为「下 3 周」。
- **+new 按钮**（`＋`，disabled 占位，SIK-FU-N）：保留 disabled，不在本 issue 激活。
- **countdown chip**（`国考 D-138`，`data-testid=home-calendar-countdown`）：**W4 删除**（§5）。

### 2.2 chip（月 + 周，W1 统一）

- chip 是可聚焦 `<button>`（保留现有 `MonthEventChip` button 语义）。
- **月视图**：`onClick` → 开只读 Peek（现状已接）；W1 不动接线，只改表面。
- **周视图**：W1 先统一为同组件（**不传 onClick = 只读不可点**）；**W5 接 `onClick` → Peek**（defer to W5）。
- chip 表面控件（W1 通道收敛后）：kind 中性 leading 图标 + title + done ✓ 勾（仅 done tone）。
- chip 拖拽 handle（`drag` prop）：**仅月视图 dnd 路径传**（SIK-139），周视图不传。本 issue 不改 drag 接线。

### 2.3 cell 溢出（W3）

- 现状：cell 超 `cardLimitPerCell` 显示 `+N 更多`（`data-testid=home-month-overflow`）。
- **W3 目标**：去掉 `+N 更多`；cell 事件列表超 3 条改 **格内纵向滑动**（`overflow-y:auto` + 隐藏滚动条）。
- 周视图同步：`cardLimitPerCell` 从「无限」收为 `3`，超出同样格内滑动。
- 桌面端：滚轮滑动；触摸端手势冲突留移动阶段（结构预留，§6 标注）。

### 2.4 Peek（W5）

- 周视图 chip 点击 → 复用现有 `CalendarPeekCard`（只读）：head + properties + notes 区。
- source / link / target 三通道（W1 从 chip 移出）在 Peek properties 区展示。
- **不做** inline 编辑控件（title/notes 输入框、属性下拉）—— SIK-140 范围（H1 边界）。

不得移除的既有元素：chip onClick→Peek（月）、cell 数字 / today 标记、segment 视图切换、prev/today/next 导航。

## 3. Information Density

### 3.1 chip 通道收敛（W1 核心，lhr 2026-05-29 拍板）

SIK-138 chip 占 7 通道（kind 边色 / title / category / status dot / source icon / link icon / target badge）。
本 issue **收敛到 4 个表面通道**，其余移到 Peek：

| 通道 | SIK-138 现状 | SIK-142 chip（W1 后） | 去向 |
|---|---|---|---|
| 时间状态色 | 无（chip 用 kind 配色） | **border-left + bg + 文字色**（tone，§3.2） | 新增，chip 主通道 |
| kind | border-left 色 + tint bg | **中性 leading 图标**（不带色） | 降级为图标 |
| title | primary 文字 | primary 文字（skipped 加删除线） | 保留 |
| done 标记 | status dot done 态 | **✓ 勾**（双重编码，仅 done tone） | 并入 tone |
| category | detail preset 次要文字 | 不在 chip | → Peek |
| status dot | 独立 dot | 不在 chip（done 用勾，其它用 tone 色） | 并入 tone |
| source icon | Sparkles/Plus/Download | 不在 chip | → Peek（W5） |
| link icon | Link2 | 不在 chip | → Peek（W5） |
| target badge | `T` 圆标 | 不在 chip | → Peek（W5） |

- 窄 chip 极端密度：kind 图标可降级隐藏，**title 优先**（实现按容器宽度判断，W1 拍板取值）。
- chip 状态量沿用 4-state（loading / empty / error / ready）由 view 容器持有，chip 自身只渲染 ready。

### 3.2 tone 时间状态表（W1，单一真相源 `deriveChipTone`）

优先级级联，从上往下命中即停（done > skipped > overdue > today > future）：

| tone | 判定 | border-left | bg | 文字 | 额外编码 |
|---|---|---|---|---|---|
| done | `status==='done'` | `--cal-event-done-border` | `--cal-event-done-bg` | `--cal-event-done-text` | **✓ 勾**（色盲友好双重编码） |
| skipped | `status==='skipped'` | `--cal-event-skipped-border` | `--cal-event-skipped-bg` | `--cal-event-skipped-text` | title 删除线 |
| overdue | 结束 < 今天 且未完成 | `--cal-event-overdue-border` | `--cal-event-overdue-bg` | `--cal-event-overdue-text` | 无删除线 |
| today | occurrence 落在今天 | `--cal-event-today-border` | `--cal-event-today-bg` | `--cal-event-today-text` | 最抓眼 |
| future | occurrence > 今天 | `--cal-event-future-border` | `--cal-event-future-bg` | `--cal-event-future-text` | 淡黄描边 + 近白底，弱提示 |

- token 语义映射见 §4；全部引用现有 V5 语义 token，**无 hex / 无 color-mix 百分比硬编码**（Prototype-Token-Map §12 红线）。
- **skipped vs overdue 同色（设计说明）**：两者共用 disabled/sunken 灰系（都属「未完成且不再活跃」），靠**删除线**区分（skipped 有 / overdue 无）；灰度/色盲下删除线是主区分编码。有意设计，lhr 2026-05-29 拍板。
- **H7 borderline 锚点定义**：
  - today / future 按 **occurrence 起始本地日**（跨日事件按 `slice.day`）与当前本地日比较。
  - overdue 用 **occurrence 结束本地日 < 今天本地日**（结束都过了才算逾期；done/skipped 已在前两级命中，不进 overdue）。
  - 全部按 **Asia/Shanghai 本地日**做 `YYYY-MM-DD` 串比较，禁 UTC 裸 `Date` 比；时间解析失败抛错不 fallback（H7）。
- **本地日 helper 选型（H1 修正，详见 §5 C9）**：repo 现有**两个**本地日 helper：
  - 引擎层 `@sikao/calendar-engine` `toLocalDateStamp(value, tz)`（timezone.ts:19，经 index 导出，**不抛错只格式化**）。
  - 应用层 `dragDrop/conflictGuard.ts` `zonedDateKey(iso, tz)`（L66，SIK-139 引入，**解析失败显式抛错**，H7-compliant，有 `conflictGuard.test.ts` 覆盖）。
  - **W1 决策（lhr 2026-05-29 拍板）**：tone 派生要求解析失败抛错，将抛错语义的本地日 helper **提升为 shared util**（如 `@sikao/shared-utils` 或 calendar-engine 导出），统一供 tone 派生 + conflictGuard 复用；不得静默降级到不抛错的 `toLocalDateStamp`。原 `conflictGuard.ts` 的 `zonedDateKey` 改为引用该 shared util（保持 test 绿）。

### 3.3 chip 几何（遵守原型 v2.1）

- 月 chip（原型 `.m-event`，HTML L895-903）：`font 11px / padding 3px 7px / radius 5px / border-left 3px / bg=paper-2`。
- 周 chip（原型 `.day-event`，HTML L632-643）：`font 10.5px / padding 2px 6px / radius 4px / border-left 2px / bg=paper-2`。
- **W1 取值（拍板）**：周/月 chip **统一到一套** `MonthEventChip` 组件几何，以**月 chip 为基准**（`font 11px / radius 5px / border-left 3px`），周视图复用同组件即同几何。现有 `--cal-chip-*` token（border-w 4px / radius `--radius-6` / padding-y 3px）与原型有微差，W1 在 §6 记 drift 并按本契约取值收敛到原型基准（见 §4.2）。

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`（H11 强制查表）。本 issue 用到的原型 var → V5 token：

### 4.1 原型 var → V5 token（直接映射）

| 原型 var | V5 token | 用途 |
|---|---|---|
| `--paper-1` | `--color-bg-surface` | future chip 近白底 / cell 底 |
| `--paper-2` | `--color-bg-elevated` | chip 默认底（原型 `.m-event` / `.day-event` bg） |
| `--paper-3` | `--color-bg-sunken` | skipped / overdue chip 底 |
| `--ink-1` | `--color-text-primary` | chip primary 文字 / today m-num 实心圈底 |
| `--ink-3` | `--color-text-meta` | skipped/overdue 文字 / dim m-num |
| `--ink-4` | `--color-text-disabled` | skipped/overdue border-left / out-of-month dim |
| `--brand-yellow` | `--color-brand-primary` | today border-left |
| `--brand-yellow-soft` | `--color-brand-soft` | today 格底 / today chip bg / future border-left |
| `--ok` | `--color-state-ok` | done border-left |
| `--ok-50` | `--color-state-ok-soft` | done chip bg |
| `--line-1` | `--color-border-subtle` | cell 网格线 |
| `--r-card-sm` | `--radius-12` | Peek 卡圆角（已有 `--cal-peek-radius`） |

> **禁**：生产 `.module.css` 直写 `var(--paper-2)` / `var(--brand-yellow-soft)` 等原型 var；
> 一律走右列 V5 token 或下方 `--cal-event-*` 组件 token。
>
> 注（§4.1 用途列读法）：上表「用途」列描述的是各 token 在**收敛后**的最终用途。
> chip bg 在 W1 后由 §3.2 tone（`--cal-event-{tone}-bg`）决定，`--color-bg-elevated`
> 仅作 chip **未命中 tone 时的中性兜底底色**（理论上 5 tone 全覆盖，兜底极少触发）；
> 原型 `.m-event` 的 `paper-2` 默认底在 tone 体系下被 tone bg 取代，非逐 kind 保留。

### 4.2 新增组件 token（W1 落 tokens.css §8 单源）

`--cal-event-{tone}-{border,bg,text}`，15 个，全部转引现有 V5 语义 token（无 hex / 无 color-mix %）：

| token | 引用 | token | 引用 | token | 引用 |
|---|---|---|---|---|---|
| `--cal-event-done-border` | `var(--color-state-ok)` | `--cal-event-done-bg` | `var(--color-state-ok-soft)` | `--cal-event-done-text` | `var(--color-text-primary)` |
| `--cal-event-skipped-border` | `var(--color-text-disabled)` | `--cal-event-skipped-bg` | `var(--color-bg-sunken)` | `--cal-event-skipped-text` | `var(--color-text-meta)` |
| `--cal-event-overdue-border` | `var(--color-text-disabled)` | `--cal-event-overdue-bg` | `var(--color-bg-sunken)` | `--cal-event-overdue-text` | `var(--color-text-meta)` |
| `--cal-event-today-border` | `var(--color-brand-primary)` | `--cal-event-today-bg` | `var(--color-brand-soft)` | `--cal-event-today-text` | `var(--color-text-primary)` |
| `--cal-event-future-border` | `var(--color-brand-soft)` | `--cal-event-future-bg` | `var(--color-bg-surface)` | `--cal-event-future-text` | `var(--color-text-primary)` |

- 落 `:root` §8 单源；`[data-theme='dark']/[data-theme='night']` 因全部转引语义 token，**dark theme 自动跟随**，无需重定义（与 §8.1 kind token dark 做法一致；若 smoke 发现暗色对比不足再在 §8 dark 段补，W1 记录）。
- chip 几何 token 收敛（§3.3 drift）：`--cal-chip-radius` 由 `--radius-6` 调到原型 5px 基准（新增 `--radius-5` 或在 contract 标注 5px 例外，W1 拍板）；`--cal-chip-border-w` 4px → 3px（对齐原型 `.m-event` border-left 3px）。具体取值 W1 落 token 时定，记 §6 drift。

### 4.3 kind 中性图标（W1）

- kind 降级为 leading 图标，**不带 kind 配色**（颜色通道已被 tone 占用）。图标走 `lucide-react`（现有依赖），统一 `--cal-icon-size`（12px）+ `--color-text-meta` 中性色。
- kind→图标映射 W1 在 `eventKind.ts` 旁定义（plan / practice / mock / milestone 各一），Define-First 落表。

### 4.4 隐藏滚动条模式（W3，原型 `.view-today` HTML L778-786）

- `scrollbar-width: none`（Firefox）+ `-ms-overflow-style: none` + `::-webkit-scrollbar { display: none }`（WebKit）。
- 这是行为模式不是 token；W3 复用到月+周 cell 溢出滑动容器。lint-screen-lock 不应误伤（W3 验证确认）。

## 5. SSOT Conflicts

| # | 冲突项 | 原型 authority | 当前系统 authority | 采用真相源 | lhr 拍板 |
|---|---|---|---|---|---|
| C1 | chip 配色语义 | kind 配色（`.m-event.k-practice` 黄 / `.k-mock` 实心黄 / `.k-milestone` 红） | SIK-138 chip 也用 kind 配色（`--cal-kind-*`） | **时间完成状态配色**（done/skipped/overdue/today/future），kind 降级中性图标 | 2026-05-29 |
| C2 | 月视图窗口 | `.view-month` = 3×7 rolling（本周一起 3 周，HTML L857 注释 + renderMonth L1789） | SIK-126 实现 = 6 周 42 格整月 + 局部滚 | **原型 3 周 rolling window**（21 格 + 无滚动） | 2026-05-29 |
| C3 | 月视图溢出 | 原型 `.m-more` = `+N 项` 截断 | SIK-138 实现 = `+N 更多`（`home-month-overflow`） | **去掉 `+N`，改格内滑动**（原型 today 视图隐藏滚动条模式复用） | 2026-05-29 |
| C4 | 视图集合 | 原型有 today（24h 横滚）/ week / month 三视图 | SIK-126/138 实现三视图 + store union `'today'|'week'|'month'` | **删 today，收窄 `'week'|'month'`** | 2026-05-29 |
| C5 | countdown chip | 原型 panel-head 无 D-138 chip（是后加的占位） | SIK-FU-A 实现 `home-calendar-countdown` 静态占位 | **删除**（无真实 exam target store 支撑，占位不留） | 2026-05-29 |
| C6 | 周 chip 可点性 | 原型 `.day-event` 有 hover popover，无点击详情 | SIK-126 实现周 chip 是纯 `<span>` 不可点 | **W5 接现有只读 Peek**（统一月/周交互） | 2026-05-29 |
| C7 | 周 cell chip 上限 | 原型周 cell 无明确上限 | SIK-126 实现周 cell 无 `cardLimitPerCell` 上限 | **统一 ≤3 条 + 格内滑动**（与月一致） | 2026-05-29 |
| C8 | chip 几何 token | 原型 `.m-event` radius 5px / border-left 3px | SIK-138 `--cal-chip-radius=--radius-6` / `--cal-chip-border-w=4px` | **收敛到原型基准**（radius 5 / border 3，W1 落 token） | 2026-05-29 |
| C9 | 本地日 helper（H7 时区正确性） | n/a | repo 现有**两个** helper：引擎层 `toLocalDateStamp`（timezone.ts:19，**不抛错**）+ 应用层 `zonedDateKey`（conflictGuard.ts:66，SIK-139，**抛错**，test 覆盖） | **抛错语义提为 shared util**（lhr 拍板）：tone 派生 + conflictGuard 共用；解析失败必抛（H7），不得用不抛错的 `toLocalDateStamp`；`zonedDateKey` 改引用 shared util 保 test 绿 | 2026-05-29 |
| C10 | 截图归档路径 | n/a | workflow §2.7 = `.tmp_review/visual-diff/<sik>/`；lhr 任务卡曾写 `.tmp_review/out/sik-142-w<N>/` | **归一到 workflow §2.7 强制路径 `.tmp_review/visual-diff/sik-142/`**（lhr 2026-05-29 拍板，按 workflow 标准） | 2026-05-29 |

> C1 是本 issue 最大主动偏离，理由（lhr 拍板）：备考工具里「做没做 / 是不是今天 / 逾期没」比「plan 还是 practice」更高频有用；颜色是单一通道，不能同时背 kind + 时间状态。详细 drift 见 §6。
>
> 后续 owner：source/link/target 通道在 Peek 的完整展示 = W5；inline 编辑 = SIK-140；聚合属性 = SIK-141。

## 6. Visual Drift from Prototype

所有偏离均有 lhr 拍板日期。无日期视为未授权偏离。

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| D1 chip 配色 | kind 配色（黄/红 per kind） | 时间状态配色（tone）+ kind 中性图标 | 备考工具时间完成状态比 kind 更高频；颜色单通道 | 2026-05-29 |
| D2 done 编码 | 原型无 done 态视觉 | done tone + ✓ 勾双重编码 | 色盲友好 + 完成态最该被识别 | 2026-05-29 |
| D3 skipped/overdue | 原型无此态 | skipped 删除线 / overdue 灰底无删除线 | 区分「主动跳过」vs「逾期未做」 | 2026-05-29 |
| D4 chip 通道 | 原型 chip 仅 title（+ hover popover 详情） | chip 4 通道（tone/kind 图标/title/done 勾），source/link/target 移 Peek | SIK-138 把 7 通道塞 chip 太挤，收敛 | 2026-05-29 |
| D5 chip 几何 token | radius 5 / border-left 3 (px 直写) | 走 `--cal-chip-*` token（W1 收敛到 5/3） | 生产禁 px 直写，token 单源 | 2026-05-29 |
| D6 future tone | 原型无 future 区分 | future = 淡黄描边 + 近白底弱提示 | 让「将来事件」有弱存在感不抢眼 | 2026-05-29 |
| D7 月视图整月补齐 | 原型 3 周 rolling 不显示完整月 | 实现同 3 周 rolling（放弃整月视图） | 一屏锁死 + chip 配色读得清优先于「看完整月」 | 2026-05-29 |
| D8 触摸端格内滑动 | 原型仅桌面 | 桌面端实现，移动端结构预留不实现 | 触摸「格内滑动 vs 拖拽手势」冲突留移动阶段 | 2026-05-29 |

> 与 SIK-138/139 既有实现的 drift（kind 配色 → tone）在 W1 commit message 显式说明：本 issue 主动收敛 chip 配色语义，非回归。

## 7. Acceptance Hooks

给 Reviewer / Verifier 用的对照清单。状态：`PASS` / `偏离`（指向 §6）/ `待修` / `待 W<N>`（未到该 wave）。
每 wave 实现后回填本节 + 归档 1440/1920 双开 Chrome MCP 截图。

### 7.1 实现 vs 原型 对照表

| 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|
| A1 月 chip 几何 5/3/11px | `.m-event` L895-903 | MonthEventChip.module.css | 待 W1 |
| A2 周 chip 复用月 chip | `.day-event` L632-643 | WeekCalendarView.tsx | 待 W1 |
| A3 chip 时间状态配色 tone | §6 D1（偏离 kind） | deriveChipTone.ts + tokens.css §8 | 待 W1 |
| A4 done ✓ 勾双重编码 | §6 D2（原型无） | MonthEventChip.tsx | 待 W1 |
| A5 skipped 删除线 / overdue 无 | §6 D3（原型无） | MonthEventChip.module.css | 待 W1 |
| A6 kind 中性 leading 图标 | §6 D1 | MonthEventChip.tsx + eventKind 图标表 | 待 W1 |
| A7 source/link/target 移出 chip | §6 D4 | MonthEventChip.tsx（删通道） | 待 W1 |
| A8 月视图 3 周 rolling（21 格） | renderMonth L1789-1815 | buildMonthCells | 待 W2 |
| A9 月视图 `repeat(3,1fr)` + overflow hidden | `.view-month .cal-body` L862-866 | MonthCalendarView.module.css | 待 W2 |
| A10 prev/next ±3 周翻页 | n/a（原型 anchor 推导） | CalendarPanel handlePrev/Next | 待 W2 |
| A11 月+周 cell ≤3 条 | `top3 = slice(0,3)` L1804 | calendarViewConfig cardLimitPerCell | 待 W3 |
| A12 格内滑动无滚动条 | `.view-today` 隐藏滚动条 L778-786 | Month/Week cell CSS | 待 W3 |
| A13 去 `+N 更多` | §5 C3 | MonthCalendarView.tsx | 待 W3 |
| A14 删 today 视图 + 类型收窄 | §5 C4 | TodayCalendarView 删 + 3 处 union | 待 W4 |
| A15 去 countdown chip | §5 C5 | CalendarPanel.tsx | 待 W4 |
| A16 persisted 'today' 归一 'week' | §5 C4 / H7 | calendarViewConfig preferenceKeys | 待 W4 |
| A17 周 chip 可点 → 只读 Peek | §5 C6 | WeekCalendarView + peek | 待 W5 |
| A18 Peek V5 对齐 + 3 通道展示 | §6 D4 | CalendarPeekCard 等 | 待 W5 |

### 7.2 截图归档

- 归档路径（workflow §2.7 强制，lhr 2026-05-29 拍板归一）：`.tmp_review/visual-diff/sik-142/`
  - 每 wave **必须**有 `1440×900` 与 `1920×1080` 两档实现截图；W1+ 配原型对照（`prototype` + `implementation` 各一）。
  - 命名建议：`w<N>-<view>-<width>-{prototype|impl}.png`（如 `w1-month-1440-impl.png`）。
- prototype 对照来源：`.tmp_review/out/Tab1-Home/Home v2.1.html`（月/周视图）。

### 7.3 a11y / 验证命令（每 wave）

在 `apps/web`：

- `npm run typecheck`
- `npx eslint <改动文件>` + `npm run lint:scripts`（自定义 linter 全跑）
- `node scripts/lint-hardcode.mjs` / `lint-shadow-token.mjs` / `lint-zindex-token.mjs` / `lint-screen-lock.mjs`
- `npx vitest run src/views/Home/`（不回归：现 dragDrop 47 + Home 全绿）
- `npm run test:a11y`（vitest-axe 0 violation）
- Browser smoke：dev 18080 + Chrome DevTools MCP 1440/1920 双开
- 备注：全量 vitest 下 `EssayGradingResult.test.tsx` 是已知无关 flake（隔离 PASS），不计 fail。

### 7.4 W0 自检（本 wave）

- [x] 7 节结构齐全（§1-§7）
- [x] tone 表精确 token（§3.2 + §4.2，15 个 `--cal-event-*` 全转引 V5 语义 token）
- [x] chip 几何 + 3 周窗口 + 隐藏滚动条模式（§3.3 / §1.1 / §4.4）
- [x] §5 SSOT Conflicts（C1 kind→tone 偏离 + C9 双 helper 抛错语义 + C10 截图路径）+ §6 Drift（8 项含 lhr 拍板）
- [x] H11 强制查表（§4 引用 Prototype-Token-Map）
- [x] W0 review fail 修复：C9 改写为「repo 双 helper 并存」真实冲突 + 采用抛错语义（F1 High）；§7.2 截图路径冲突记 C10（F2）；§3.2 overdue/today/future 锚点 + skipped≈overdue 同色删除线区分写明（F3/F6）；§4.1 elevated 兜底读法注（F5）
- [x] 独立 subagent review（文档 >50 行触发 H5）→ `docs/reviews/sik-142-w0.md`（含复审）
