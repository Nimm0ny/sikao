# Requirements Document

> SIK-140 Calendar Inline Editing (Phase 4)
>
> 本文从零定义 inline editing 契约，显式替代“Requirement 19 已存在”的错误背景。
> 上游 SSOT:
> - Notion issue: SIK-140
> - plan: `docs/plan/sik-140-calendar-inline-editing-plan.md`
> - visual contract: `docs/plan/sik-140-calendar-inline-editing-visual-contract.md`
> - parent spec: `.kiro/specs/sik-138-home-calendar-v2/{requirements.md,design.md}`

## Overview

在 SIK-138 / SIK-142 完成后的 Home calendar 中，月/周 chip 已统一接入只读 Peek。
Phase 4 只在 **Peek 卡片内部** 解锁 inline editing，不新增页面级编辑器，不改 drag-drop 时间写入路径。

V1 scope:

- editable title
- editable notes
- editable status
- editable category
- editable targetId

## Non-goals

- 不编辑 `startAt` / `endAt` / `timezone`
- 不做 recurring series 级 UI
- 不新增“新建事件”流程
- 不在 month/week chip 表面直接编辑
- 不触碰 SIK-139 的 drag-drop / conflict / keyboard move 主链
- 不做聚合属性（SIK-141）

## Requirement 1: Stable Write Boundary

所有写入必须复用既有：

- `PATCH /plans/events/{eventId}`
- `PlanEventUpdateRequestV2`
- `useUpdateEvent(eventId, { scope? })`
- `usePlanStore.optimisticEvents`

禁止新增并行写端点、禁止新建全局 store。

## Requirement 2: Editable Field Set

Phase 4 V1 的可编辑字段集合固定为：

- `title`
- `notes`
- `status`
- `category`
- `targetId`

限制：

- `status` 仅允许 `planned | in_progress | done | skipped`
- `category` 必须来自受控选项源，不允许自由新建类别
- `targetId` 可清空，但空值语义必须显式

以下字段在 Phase 4 中保持只读：

- `startAt`
- `endAt`
- `timezone`
- `recurringRule`
- `linkedSessionId`

## Requirement 3: Explicit Commit Model

V1 采用 **显式提交**，不是 blur auto-save：

- 字段进入编辑态后显示 `Save / Cancel`
- `Save` 才触发 PATCH
- `Cancel` 还原草稿并退出编辑态
- 切换到另一条 Peek item 时，若有未提交改动，必须先中止当前编辑态

## Requirement 4: Optimistic + Rollback

每次字段提交必须：

1. validate
2. `upsertOptimisticEvent(event.id, patch)`
3. PATCH
4. success -> `removeOptimisticEvent(event.id)` + refetch 真值接管
5. failure -> `removeOptimisticEvent(event.id)` + 恢复编辑前值 + 显式错误提示

禁止：

- silent catch
- PATCH 失败后保留脏 optimistic 值
- 用默认值覆盖失败字段

## Requirement 5: Keyboard Ownership

编辑态必须显式接管现有 Peek 全局键盘行为：

- `idle/read-only`
  - `Esc` 关闭 Peek
  - `ArrowUp/ArrowDown` 在当前 peek list 内翻上一条/下一条
- `editing(single-line field or select)`
  - `Esc` 取消当前字段编辑态
  - `ArrowUp/ArrowDown` 只服务当前控件，不触发全局 prev/next
  - `Enter` 可触发 Save
  - scrim click -> 先 cancel 当前字段，再 close Peek
- `editing(notes textarea)`
  - `Esc` 取消当前字段编辑态
  - `ArrowUp/ArrowDown` 始终属于文本光标移动
  - `Ctrl/Cmd+Enter` 触发 Save
  - scrim click -> 先 cancel 当前字段，再 close Peek
- `saving`
  - `prev/next/close` disabled
  - `Esc` ignored
  - 不允许切换到别的 event
  - scrim click ignored

## Requirement 6: Partial Editable Banner Policy

旧的只读 banner 在 Phase 4 中分三态：

- `read-only phase`：保留现有只读 banner
- `partial-editable phase`（W1/W2 期间）：
  - banner 保留在 notes section footer
  - 文案改为：`部分字段现已可编辑；时间与重复规则仍为只读。`
  - 当前有字段进入编辑态时，banner 隐藏
- `fully-editable phase`（W3 closeout）：
  - 静态 banner 全局移除

禁止继续沿用旧文案 `V1 只读…`。

## Requirement 7: Focus / A11y

编辑态必须满足：

- `Tab` 顺序可达
- `Save / Cancel` 被 screen reader 正确识别
- 字段切换与 head buttons disabled 状态有明确可感知反馈
- `vitest-axe` 0 violation

## Requirement 8: Fail-Fast

以下场景必须 fail-fast：

- 空 title 提交
- 非法 status / category / targetId
- PATCH reject
- optimistic patch 与真实 event id 不匹配
- 事件已切换但旧编辑态仍尝试提交

## Requirement 9: Visual Contract

Runner Wave 0/1 前必须落：

- `docs/plan/sik-140-calendar-inline-editing-visual-contract.md`

并在 issue acceptance 中显式引用。

## Acceptance

- [ ] spec 从零定义 inline editing 契约，不援引不存在的 Requirement 19
- [ ] visual contract 落地且满足 H11 七节结构
- [ ] 可编辑字段、提交模型、keyboard ownership、banner policy 定义完整
- [ ] 独立 review
