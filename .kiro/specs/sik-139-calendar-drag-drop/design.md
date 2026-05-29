# Design Document

> SIK-139 Calendar Drag-Drop (Phase 3 / dnd-kit)
>
> Define-First 骨架（H6）。锁定模块边界与数据流；细节（冲突 UX、键盘入口二选一）
> 待 Master 拍板后在本文件补全。不含实现代码。
>
> 上游：`docs/plan/sik-139-calendar-drag-drop-plan.md` + 母 spec
> `.kiro/specs/sik-138-home-calendar-v2/design.md`。

## Overview

为 Home 月视图引入 dnd-kit 驱动的 chip 拖拽改期，保持 SIK-138 V1 的
`CalendarPanel` 外壳与状态模型不变；写路径复用既有 `useUpdateEvent`，
乐观渲染复用 `usePlanStore.optimisticEvents`。

## Architecture

### 复用面（不重造）

| 层 | 复用对象 | 文件 |
|---|---|---|
| DnD | `@dnd-kit/core`（DndContext / PointerSensor / KeyboardSensor / useDraggable / useDroppable） | 已装未用 |
| Store | `usePlanStore.optimisticEvents` + `upsertOptimisticEvent` / `removeOptimisticEvent` | `packages/domain/src/plan/usePlanStore.ts` |
| Mutation | `useUpdateEvent` / `updateEvent` / `RecurringScopeConfig` | `packages/api-client/src/plansMutations.ts` |
| Conflict | `detectEventConflicts` | 同上 |
| Projection | `expandPlanEventsForView` / `sliceMonthOccurrencesByDay` | `apps/web/src/views/Home/sections/calendarEvents.ts` |
| Chip | `MonthEventChip`（Wave 0 补 `data-event-id` / `data-peek-anchor` + optimistic merge） | `apps/web/src/views/Home/sections/MonthEventChip.tsx` |

### 目标模块（待 Runner 细化）

```text
apps/web/src/views/Home/sections/
  MonthCalendarView.tsx          # 包 DndContext + droppable 日格
  MonthEventChip.tsx             # Wave 0 加锚点 + draggable + optimistic merge
  dragDrop/                      # 新增（Phase 3）
    useCalendarDrag.ts           # dnd-kit sensors + onDragEnd 编排
    rescheduleEvent.ts           # 时间平移计算（纯函数，可单测）
    conflictGuard.ts             # detectEventConflicts 包装
    keyboardReschedule.ts        # 键盘移动模式状态机
```

> 模块路径为建议；Runner 在 Wave 0 spec 细化时可调整，但不得引入新全局 store
> 或新后端端点。

## Data Flow

```text
drag start (chip)
  → dnd-kit useDraggable(eventId, data-event-id)
drag over (day cell)
  → useDroppable(dateKey) 高亮 + aria-live 播报候选落点
drag end (drop on day cell)
  → rescheduleEvent(event, dropDate) → { startAt, endAt }（保留时长/时分/tz）
  → conflictGuard.check(...) via detectEventConflicts
      conflict → 按拍板 UX（阻断 / 二次确认），不自动提交
      clear    → upsertOptimisticEvent(id, patch)
                 → useUpdateEvent(id).mutateAsync({ startAt, endAt })
                     success → removeOptimisticEvent(id)（invalidate 接管）
                     reject  → removeOptimisticEvent(id) + 显式错误提示
keyboard path
  → KeyboardSensor 进入移动模式 → 方向键步进 dropDate 预览 → Enter 确认 / Esc 取消
     （确认走同一 drag end 编排）
```

## Reschedule 计算（纯函数，TDD 优先）

`rescheduleEvent(event, dropDateKey)`：

- 输入：`PlanEventReadV2`（或 occurrence）+ 目标日 `YYYY-MM-DD`
- 输出：`{ startAt, endAt }`，规则：
  - 保留原 `startAt` 的时分秒 + 时区
  - `endAt = startAt + 原时长`
  - 仅替换日期部分到 `dropDateKey`
- fail-fast：解析失败抛错；dropDate 非法格式抛错

跨日事件：以 occurrence 起始日为锚整体平移；recurring 默认单次（scope 缺省）。

## Error Handling（H7）

见 requirements Requirement 6。设计层补充：

- `conflictGuard` 网络/解析异常 → 抛错并触发回滚，不吞异常
- mutation reject → 回滚乐观 patch；UI 错误提示走项目既有提示通道（不 `console.log`）
- 拖拽取消（Esc / 非法 drop）→ 清理拖拽态，无 store 写入

## Testing Strategy

### Unit

- `rescheduleEvent.test.ts`（时长保持 / 跨日 / 跨月 / 时区 / 非法输入抛错）
- `conflictGuard.test.ts`（conflict / clear / 网络失败回滚）
- `useCalendarDrag.test.tsx`（drop → 乐观 patch → 成功清除 / 失败回滚）
- `keyboardReschedule.test.ts`（方向键步进 / Enter / Esc）

### Browser

- 1440 + 1920
- 拖拽态 / drop 高亮 / 键盘移动态 / 冲突提示态
- 乐观渲染 → 真实数据接管 / 失败回滚

### a11y

- vitest-axe 0 violation
- KeyboardSensor 键盘走查 + aria-live 播报

## Rollout（Wave）

对应 plan §7：

- Wave 0：spec + 锚点债补齐 + chip optimistic merge + 视觉契约
- Wave 1：DndContext + sensors（drop = no-op 占位）
- Wave 2：drop → 平移 + 乐观 + mutation + 回滚
- Wave 3：冲突校验 + UX
- Wave 4：键盘路径 + a11y + 验收 closeout

## Decisions（Master 拍板 2026-05-29，lhr 可推翻）

> 这三项原为 Open Decisions。Master 先给默认裁决让 Wave 1+ 不被阻塞；
> 任一项 lhr 可推翻，推翻则改本节 + 同步 Acceptance。

1. **冲突落点 UX = 二次确认弹层（非硬阻断）**
   - 理由：硬阻断会让"明知冲突仍要改期"的合法场景无路可走；日历改期不是
     强一致写，冲突是软约束。`detectEventConflicts` 返回 conflict 时弹确认层
     （列出冲突事件），用户确认后照常走 optimistic + PATCH；取消则回滚拖拽态。
   - Fail-Fast 不冲突：detect **请求本身失败**仍抛错 + 回滚（§Error Handling），
     这里"有冲突"是正常业务返回，不是错误。
2. **键盘改期入口 = chip 内联移动模式（dnd-kit KeyboardSensor）**
   - 理由：dnd-kit `KeyboardSensor` 原生支持，与拖拽共用同一 `onDragEnd` 编排，
     实现面最小、行为最一致；Peek 承载会引入"只读 Peek 里塞写操作"的范围蔓延
     （那是 SIK-140 的事，Phase 3 不碰 Peek 写）。
   - chip 聚焦 → `Space/Enter` 进入移动模式 → 方向键按日步进预览 → `Enter` 确认 /
     `Esc` 取消；落点经 `aria-live=polite` 播报。
3. **recurring occurrence 拖拽 = V1 暴露，默认单次（scope 缺省）**
   - 理由：occurrence 已能拖（chip 就是单个 occurrence），强行禁用反而要加特判；
     默认单次平移（scope 缺省，后端裁决单次语义），series 级改期 UI 仍是 Non-goal。
   - recurring chip 拖拽时给一处轻提示"仅改这次"（文案待视觉契约定），避免误解为改整条。

## W3 Conflict Check Design (Define-First, 2026-05-29)

> 在 W2 的 drop 编排（`resolveCalendarDrop` → `commitReschedule`）之上插入落点冲突
> 校验。契约形状已对当前 main 代码核实（`api.generated.ts`）。

### 调用边界（复用既有，不新增端点）

- 端点：`POST /plans/events/conflicts`，client `detectEventConflicts(payload)` /
  hook `useDetectConflicts()`（均已存在于 `plansMutations.ts`）。
- 请求 `EventConflictsRequestV2`：
  - `events: ProposedPlanEventV2[]` — 放**改期后**的那一个 proposed 事件
    （字段：`title` / `category` / `startAt` / `endAt`（date-time）/ `timezone` /
    `recurringRule?`）。改期后的 `startAt`/`endAt` 取自 `rescheduleEvent` 的结果；
    其余字段取自被拖拽事件。
  - `existingWindow: { from, to }`（date）— 落点所在的查询窗口（复用月视图当前
    `buildViewRange('month', ...)` 的 from/to）。
- 响应 `EventConflictsResponseV2`：`conflicts: EventConflictItemV2[]`
  （每项 `startAt` / `endAt` / `kind` / `sourceId` / `title`）。`conflicts` 为空数组
  即无冲突。

### 决策流（插在乐观写之前）

```text
resolveCalendarDrop → reschedule decision (startAt/endAt)
  → detectEventConflicts({ events:[proposed], existingWindow })
      response.conflicts 为空 → 直接走 W2 commitReschedule（乐观 + PATCH）
      response.conflicts 非空 → 打开二次确认弹层（列出 conflicts）
          用户「确认改期」 → 走 commitReschedule（乐观 + PATCH）
          用户「取消」     → 不写 store、不发 PATCH、清拖拽态
  → detect 请求本身失败（网络/解析）→ 抛错 + toast + 不提交（AGENT-H7，
     这是 error，不是「有冲突」的正常返回）
```

关键区分（design Decisions 1 已拍板）：「有冲突」是**正常业务返回**走二次确认；
「detect 请求失败」是**错误**走 fail-fast。两者不可混为一谈。

### 模块（建议，Runner 可微调）

```text
dragDrop/
  conflictGuard.ts          # detectEventConflicts 包装：入参 proposed+window，
                            #   出参 { hasConflict, conflicts }；纯网络封装，
                            #   请求失败抛错（不吞）
  ConflictConfirmDialog.tsx # 二次确认弹层：列出 conflicts，确认/取消两按钮
  ConflictConfirmDialog.module.css
```

弹层视觉：复用 Peek/dialog 既有 token（`--cal-peek-scrim` + `--shadow-l4` +
`--radius-14`，见契约 §4 冲突确认层行），portal 挂载 + FocusTrap + Esc 取消 +
focus restore（与 SIK-138 Peek 同 a11y 套路，但这是**可写**的确认层，非只读 Peek）。

### Fail-Fast（H7，补 requirements R6/R7）

- detect 请求失败 → 抛错 + `toast.error` + 不提交，不静默当「无冲突」放行。
- 弹层「取消」→ 干净退出（无 store 写、无 PATCH）。
- 确认后的 commitReschedule 失败路径沿用 W2（乐观回滚 + toast）。

### 与 W2 编排的接缝

`commitReschedule` 不动（W2 已 review pass）；W3 在它**之前**加一道 conflict gate，
gate 通过（无冲突或用户确认）才调 `commitReschedule`。这样 W2 的乐观/回滚契约零改动，
W3 只新增「校验 + 确认」前置。

### W3 Testing（TDD）

- `conflictGuard.test.ts`：无冲突 / 有冲突 / 请求失败抛错（mock detect）
- conflict gate 编排测试：有冲突 → 不直接提交、开弹层；确认 → commitReschedule；
  取消 → 无副作用；detect 失败 → toast + 无提交
- `ConflictConfirmDialog` 渲染 + a11y（FocusTrap / Esc / 按钮）
- browser smoke（Verifier）：真实冲突落点 → 弹层 → 确认落格 / 取消归位



## H11 视觉契约原型缺口（Wave 0 blocker，需 lhr 裁决）

H11 要求"对应原型已存在于 `.tmp_review/out/**`"时实现前必落 visual-contract。
现状核查（2026-05-29）：

- 月视图静态布局原型存在：`.tmp_review/out/Tab1-Home/Home Month Calendar v1.html`
- 但该原型**只有静态 chip + DayDetailDialog，无任何拖拽态 / drop 高亮 / 键盘移动态**
- Phase 3 的交互态（dragging chip / drop-target 日格高亮 / keyboard-move 预览 /
  冲突确认层）**无原型来源**

可用的 SSOT 复用面（非凭空发明）：

- `--color-focus-ring` / `--input-ring-focus`（focus 态）
- `--cal-*` token 家族（kind / chip / peek）已存在
- Design-System §B 卡片状态词表**已含 `dragging` 态**（5 卡型 × 9 态）

裁决（lhr 已认可 2026-05-29）：Phase 3 交互态无独立原型，**视觉契约以"扩展
Design-System §B dragging 态 + 复用 focus-ring/cal token 推导 drop/keyboard 态"
为基准**，原型对照表仅覆盖静态月视图布局不回归，交互态走 token 推导 + 实现即契约。
Wave 0 视觉契约据此落档（`docs/plan/sik-139-calendar-drag-drop-visual-contract.md`）。

## References

- `docs/plan/sik-139-calendar-drag-drop-plan.md`
- `.kiro/specs/sik-138-home-calendar-v2/{requirements.md,design.md}`
- `docs/vault/04-design/{Design-System.md,Web-Layout.md,Prototype-Token-Map.md}`
- `packages/api-client/src/plansMutations.ts`
- `packages/domain/src/plan/usePlanStore.ts`
- `apps/web/src/views/Home/sections/{MonthEventChip.tsx,calendarEvents.ts}`


## W4 Keyboard Reschedule Design (Define-First, 2026-05-29)

> 补 H6 触发项：键盘**移动模式状态机** + 方向键步进语义 + aria-live 落点播报点
> + 与 W2 commit / W3 conflict gate 的接缝。不重新拍板入口 UX（§Decisions 2
> 已锁「KeyboardSensor inline 移动模式」）；本段只把已拍板的入口落成可实现 + 可单测
> 的精确契约。

### 入口 UX（已拍板，复述边界，不重议）

- chip 聚焦 → `Space` / `Enter` 进入移动模式（dnd-kit `KeyboardSensor` 默认
  `start` 键）。
- 移动模式下方向键按**日**步进预览落点（W4 关键差异：默认 getter 是像素步进，
  W4 换成跨整 cell 的自定义 `KeyboardCoordinateGetter`）。
- `Enter` 确认 / `Esc` 取消（dnd-kit 默认 `end` / `cancel` 键）。
- 落点变化经 `aria-live=polite` 播报候选日期 + 冲突态提示。

### W4 与现状的差异（先核对，避免重造）

W1 已接 `KeyboardSensor`（默认配置）；W2 Verifier 实测「Space 拾起 → ArrowRight
跨格 → Enter 走同一改期路径 / Esc 取消无副作用」已 PASS。**但**默认
`KeyboardCoordinateGetter` 是按**固定像素**（25px）平移 `collisionRect`，对一个
7 列网格而言：一次方向键不保证正好跨到相邻日 cell，且跨行（上/下一周）几乎不可达。
W4 必须把它换成**按 cell 几何**步进的 getter，让一次方向键 = 正好一天（左右）/
一周（上下），这才满足 Requirement 5「方向键预览落点」的语义。

因此 W4 的三块：

1. **自定义 `KeyboardCoordinateGetter`（按日/周步进）** — 纯坐标计算，注入
   `KeyboardSensor.coordinateGetter`。
2. **自定义 `Announcements`（aria-live 落点播报）** — 注入
   `<DndContext accessibility={{ announcements }}>`，把 dnd-kit 默认的英文
   over-id 播报换成中文「已移动到 <候选日期>」。
3. **keyboard-move 预览描边 + grid ARIA 修**（视觉 + 既有债）。

确认路径**零新增**：方向键改的是 dnd-kit 的 `translate`，`Enter` 仍触发**同一**
`onDragEnd(event)` → `resolveCalendarDrop` → `runConflictGate` → `commitReschedule`。
W4 不碰 `handleDragEnd` 的提交编排（除非接缝需要读 `over`）。

### 移动模式状态机（纯/准纯，可单测）

dnd-kit 自己持有「是否在拖拽 / translate / over」的运行时状态；W4 **不**另造一个
平行的移动模式 store（那会和 dnd-kit 状态打架）。W4 抽出的「状态机」是**坐标决策
函数**：给定当前 `collisionRect` + 方向键 + 所有日 cell 的 `droppableRects`，
算出下一个落点 cell 的坐标。这与 W2 `resolveCalendarDrop` / W3 `runConflictGate`
同一抽法（纯函数 + DI），把可测逻辑从组件里拎出来。

```text
stepDayCoordinate(event, ctx) -> Coordinates | undefined
  输入:
    event.code ∈ {ArrowLeft, ArrowRight, ArrowUp, ArrowDown}（其余键 → undefined 交还 dnd-kit）
    ctx.collisionRect           当前拖拽 chip 的矩形（dnd-kit 提供）
    ctx.droppableRects: Map     每个日 cell 的矩形（key = cell.stamp）
    ctx.droppableContainers     启用态的 droppable 列表
  规则（按日/周步进，模仿 sortableKeyboardCoordinates 的方向筛选 + 最近角）:
    Left  → 候选 = 所有 left < collisionRect.left 的 cell，取最近（同行优先）
    Right → 候选 = 所有 left > collisionRect.left 的 cell，取最近
    Up    → 候选 = 所有 top  < collisionRect.top  的 cell，取最近（= 上一周同列）
    Down  → 候选 = 所有 top  > collisionRect.top  的 cell，取最近（= 下一周同列）
    无候选（已在边界）→ 返回 undefined（dnd-kit 保持原位，不抛错）
  输出: 选中 cell 矩形左上角对齐的 Coordinates（dnd-kit 据此更新 translate + over）
```

状态语义（非显式 store，是 dnd-kit 生命周期映射）：

| 阶段 | 触发 | dnd-kit 事件 | W4 副作用 |
|---|---|---|---|
| idle | chip 聚焦 | — | 无 |
| picked-up | `Space`/`Enter` | `onDragStart` | 进入移动模式（dnd-kit 设 active）；播报「已拾起 <事件名>，方向键移动改期」 |
| previewing | 方向键 | `onDragOver`（over 变化） | 自定义 getter 算落点；播报「已移动到 <候选日期>」；预览 cell 上预览描边 |
| confirmed | `Enter` | `onDragEnd`（over≠null） | **复用** resolveCalendarDrop → runConflictGate → commit（同拖拽路径） |
| cancelled | `Esc` | `onDragCancel` | 仅清 `activeDragId`（W1 已实现 handleDragCancel）；无 store 写、无 PATCH |

### 方向键步进语义（边界与 H7）

- 边界 cell（第一列按 Left / 最后一行按 Down 等）→ getter 返回 `undefined`，
  dnd-kit 保持当前 over，**不报错、不 wrap**（不绕回对侧，避免误改期）。
- 落点 = 原始日（方向键又走回起点）→ 与拖拽 `noop` 同义：`resolveCalendarDrop`
  已对 `overId === fromDay` 返回 `noop`，`Enter` 时不发请求（H7，零副作用）。
- 落点非法（无 over / over 不是日 cell）→ `resolveCalendarDrop` 返回 `cancel`，
  `Enter` 不提交。
- 时间计算异常仍由 `handleDragEnd` 的 try/catch 抛错 + toast（W2 已实现，不改）。

### aria-live 落点播报点（Requirement 5）

dnd-kit 的 `<DndContext accessibility={{ announcements }}>` 已内建一个
`role="status"` 的 live region（W1 Verifier 实测「dnd-kit role=status 有播报」），
W4 只替换 `Announcements` 回调内容为中文 + 候选日期，不另造 live region：

| 回调 | 触发 | 播报文案（候选日期取 `over.id` = cell.stamp 格式化） |
|---|---|---|
| `onDragStart` | 拾起 | 「已拾起「<事件名>」，使用方向键改期，回车确认，Esc 取消」 |
| `onDragOver` | 落点变化 | 「已移动到 <候选日期>」（无 over → 不播报） |
| `onDragEnd` | 确认 | 「已将「<事件名>」改期到 <候选日期>」（over=null → 「已取消改期」） |
| `onDragCancel` | 取消 | 「已取消改期」 |

冲突态播报：冲突弹层本身是 `role="alertdialog"`（W3 已实现），打开即被 SR 朗读，
故落点冲突的「态」由弹层承载，aria-live 不重复播冲突细节（避免双重朗读）。
`onDragEnd` 播报在 `handleDragEnd` 同步阶段即「已改期到 X」，但实际 commit 可能因
冲突被 gate 拦下开弹层——这是可接受的：方向键确认的语义是「我要改到这天」，
冲突弹层再做二次确认，与拖拽路径**完全一致**（design Decisions 1）。

### 模块（建议，Runner 可微调）

```text
dragDrop/
  keyboardReschedule.ts        # ① stepDayCoordinate（纯坐标 getter，DI droppableRects）
                               # ② buildRescheduleAnnouncements（纯函数，产 Announcements 对象）
  keyboardReschedule.test.ts   # 方向键步进 / 边界 undefined / 播报文案
```

`useCalendarDragSensors` 改为接受 `coordinateGetter`（或内部直接用
`stepDayCoordinate`）注入 `KeyboardSensor`；`MonthGridDnd` 把
`buildRescheduleAnnouncements(...)` 注入 `DndContext accessibility`。两者都是
**接缝级**改动，不动 W2/W3 核心。

### grid / gridcell ARIA 修（W1 Low / W2 M-2 既有债，W4 收口）

现状报错（IDE axe + 静态扫描）：

1. `role="grid"` 直接套 `role="gridcell"`，**缺 `role="row"` 中间层**。
2. gridcell 内 dnd-kit `useDraggable` 注入的 `ul`（实为 chip `button[tabindex]`）
   触发「grid 子节点角色不合法」。

修法（**MonthGridDnd + 静态 MonthGrid fallback 两处一致**，否则 Suspense 切换漂移）：

- 在 `role="grid"` 与 `role="gridcell"` 之间补 `role="row"`：每 7 个 cell（一周）
  包一个 `role="row"`，共 6 行。grid → row → gridcell 三级合法。
- 现有 CSS 是 `gridBody` 上 `display:grid` 直接排 42 个 cell；补 row 包裹会破坏
  CSS grid 的「42 子项自动流」。解法：row 包裹层用 `display: contents`（让 row
  在视觉上透明，cell 仍直接参与父 grid 布局），既满足 ARIA 树又零视觉位移。
  `display:contents` 在受支持浏览器对布局透明，对 a11y 树保留 row 角色——正是
  此场景所需。
- gridcell 内的 chip：chip 是 `role="button"`（dnd-kit useDraggable 注入）。
  `gridcell` 允许 `button` 子节点（gridcell 可含 widget），真正的旧报错来自
  「gridcell 不在 row 内」。补 row 后该链合法。dnd-kit 给 chip 的
  `aria-roledescription=draggable` + `tabindex` 不与 gridcell 角色冲突。
- DOW 头部行已是 `role="row"` + `role="columnheader"`（现状正确），不动。

### W4 接缝总结（复用面，零核心改动）

| W4 新增/改 | 接到哪 | 是否动 W2/W3 核心 |
|---|---|---|
| `stepDayCoordinate` | `KeyboardSensor.coordinateGetter` | 否（sensors 工厂接缝） |
| `buildRescheduleAnnouncements` | `DndContext accessibility.announcements` | 否（DndContext prop 接缝） |
| keyboard 预览描边 | `.cell[data-keyboard-over]` CSS | 否（新 CSS hook） |
| grid `role="row"` 层 | MonthGridDnd + MonthGrid 渲染 | 否（DOM 结构，不碰编排） |
| `Enter` 确认 | 既有 `handleDragEnd` | 否（同一 onDragEnd） |

### W4 Testing（TDD）

- `keyboardReschedule.test.ts`：
  - `stepDayCoordinate`：Left/Right 跨一天、Up/Down 跨一周、边界返回 undefined、
    非方向键返回 undefined
  - `buildRescheduleAnnouncements`：四回调文案（拾起 / 落点变化 / 确认 / 取消）+
    over=null 分支
- `MonthGridDnd.test.tsx`（既有，扩）：
  - grid ARIA 结构：`role="grid"` > `role="row"`(×6) > `role="gridcell"`(×7/行)
  - 不回归既有 7 条（chip / cell / draggable / onClick→Peek / overflow /
    optimistic / Esc 取消）
  - F-3 收口（W3 reviewer 建议）：gate 接线组件级集成测试——键盘确认无冲突 → commit；
    （冲突 / detect 失败分支已由 runConflictGate.test 单元覆盖）
- 静态 `MonthGrid` fallback ARIA 结构测试（MonthCalendarView.test 或新建）：与 dnd
  版一致的 grid>row>gridcell
- a11y：`test:a11y` 0 violation（grid ARIA 修后；如 Home 默认视图不渲染月视图，
  补一条针对月视图 grid 的 axe 用例真正覆盖修复）
- browser smoke（Verifier 段）：W3 拖拽冲突 + W4 键盘改期，1440/1920 双开
