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
