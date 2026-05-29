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

## Open Decisions（待 Master 拍板）

1. 冲突落点 UX：硬阻断 vs 二次确认弹层
2. 键盘改期入口：chip 内联移动模式 vs 复用 Peek 卡片承载
3. recurring occurrence 拖拽是否在 V1 暴露（默认单次）或直接 defer 到后续 Phase

## Non-goals

- inline 编辑（SIK-140）/ 聚合属性（SIK-141）/ 周·今日 resize / series 改期 UI / 新建拖拽

## References

- `docs/plan/sik-139-calendar-drag-drop-plan.md`
- `.kiro/specs/sik-138-home-calendar-v2/{requirements.md,design.md}`
- `docs/vault/04-design/{Design-System.md,Web-Layout.md,Prototype-Token-Map.md}`
- `packages/api-client/src/plansMutations.ts`
- `packages/domain/src/plan/usePlanStore.ts`
- `apps/web/src/views/Home/sections/{MonthEventChip.tsx,calendarEvents.ts}`
