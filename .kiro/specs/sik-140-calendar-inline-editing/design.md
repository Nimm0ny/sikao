# Design Document

> SIK-140 Calendar Inline Editing (Phase 4)
>
> 锁定模块边界、编辑态状态机、键盘 ownership、和 SIK-139/142 的接缝。

## Overview

Phase 4 只在现有 Peek 内增加“字段级编辑态”，不重写 overlay，也不引入整页 form。

核心原则：

- 复用既有 Peek 外壳（portal / focus trap / close mechanics）
- 复用既有 PATCH 写边界
- 复用既有 optimistic store
- synthetic peek id 只用于 list scope，不得泄漏为 mutation id

## Module Ownership

建议边界：

```text
CalendarPeekCard.tsx
  - 标题展示 / 标题编辑态 owner
  - overlay, portal, kind bar

CalendarPeekProperties.tsx
  - status / category / targetId 编辑态 owner

CalendarPeekNotes.tsx
  - notes 编辑态 owner
  - partial-editable / readonly banner owner
```

如后续拆 `CalendarPeekTitleEditor.tsx`，也必须保持 title 不落到 Notes owner。

## State Model

字段级编辑态：

```text
idle
  -> editing(field)
editing(field)
  -> saving(field)
editing(field)
  -> cancelled -> idle
saving(field)
  -> success -> idle
saving(field)
  -> failure -> editing(field) + rollback
```

同一时刻只允许一个 field 处于 `editing/saving`。

## Data Flow

```text
click Edit(field)
  -> local draft seeded from currentEvent
  -> user edits
  -> Save
      -> validate
      -> upsertOptimisticEvent(event.id, patch)
      -> useUpdateEvent(event.id).mutateAsync(payload)
          success -> removeOptimisticEvent(event.id) + exit editing
          failure -> removeOptimisticEvent(event.id) + restore field
  -> Cancel / Esc
      -> discard draft + exit editing
```

## Keyboard / Navigation Contract

### Idle / Read-only

- `Esc` -> close peek
- `ArrowUp/ArrowDown` -> prev/next within peek list

### Editing

- 全局 `ArrowUp/ArrowDown` listener 暂停
- 焦点在 field 内部
- `Esc` -> cancel current field only
- `Enter` -> save (single-line/select)
- `Ctrl/Cmd+Enter` -> save (notes textarea)
- scrim click -> cancel current field, then close Peek

### Saving

- `prev/next/close` disabled
- `Esc` ignored
- 不允许切条目
- scrim click ignored

## Banner Policy

banner owner 在 `CalendarPeekNotes`：

- read-only: 旧只读 banner
- partial-editable: `部分字段现已可编辑；时间与重复规则仍为只读。`
- fully-editable: remove banner

字段处于 editing/saving 时，banner 不显示。

## Field Mapping

| UI field | payload field | validation |
|---|---|---|
| title | `title` | non-empty |
| notes | `notes` | string |
| status | `status` | enum-only |
| category | `category` | controlled options only |
| target selector | `targetId` | nullable |

## Test Strategy

Wave 1+ tests to add:

- title edit save/cancel/rollback
- notes textarea keyboard ownership
- status/category/target edit save/cancel
- saving state disables head nav
- month-opened peek and week-opened peek parity
