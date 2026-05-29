# Requirements Document

> SIK-139 Calendar Drag-Drop (Phase 3 / dnd-kit)
>
> Define-First 骨架（H6）。本文件锁定边界与硬约束，细化的验收标准（EARS / WHEN-THEN）
> 在 Runner Wave 0 补全。不含实现。
>
> 上游 SSOT：
> - plan：`docs/plan/sik-139-calendar-drag-drop-plan.md`
> - 母 spec：`.kiro/specs/sik-138-home-calendar-v2/{requirements.md,design.md}`
> - Notion issue：SIK-139 · https://www.notion.so/36fbc174f6c881ee9e7bdae2a9e3b29a

## Overview

在 SIK-138 V1（read-only Notion-like CalendarPanel）之上，为月视图 chip
新增拖拽改期能力：拖动 chip 到另一日提交一次 `startAt/endAt` 平移更新，
配乐观渲染 + 失败回滚 + 落点冲突校验，并提供键盘可达的非拖拽改期路径。

V1（本 Phase）范围：

- 月视图 chip 拖拽改日
- 乐观更新 + 失败回滚
- 落点冲突校验
- 键盘改期替代路径

明确不做（见 plan §2）：

- inline 字段编辑（SIK-140）
- 聚合属性（SIK-141）
- 周 / 今日视图时间轴 resize
- recurring series 级改期 UI
- 新建事件拖拽

## Requirement 1: 复用既有写边界，不新增端点

拖拽改期必须复用 SIK-138 已有的：

- `PATCH /plans/events/{eventId}` + `PlanEventUpdateRequestV2`
- `useUpdateEvent(eventId, { scope? })`（`packages/api-client/src/plansMutations.ts`）

拖拽 payload 只允许提交时间字段子集：`startAt` / `endAt`。
禁止在拖拽 payload 中夹带 title / notes / category / status / targetId。
禁止新增后端端点。

## Requirement 2: 乐观更新复用 usePlanStore，不改 store 形状

- 乐观写入复用 `upsertOptimisticEvent` / 回滚复用 `removeOptimisticEvent`
- patch 类型沿用 `OptimisticEventPatch = Partial<PlanEventReadV2>`
- chip 渲染层在 occurrence 投影前 merge `optimisticEvents.get(event.id)`
- 不得新增 store 字段，不得引入新的全局 store

## Requirement 3: SIK-138 遗留锚点债必须先还（Wave 0）

立项核查（2026-05-29）确认以下「父 issue 声明已留位但代码未落地」项，
Wave 0 必须补齐，不得假设已存在：

- `MonthEventChip` 增加 `data-event-id`（chip → 事件 id 映射）
- `MonthEventChip` 增加 `data-peek-anchor`（拖拽 / peek 锚点）
- chip 渲染 merge `usePlanStore.optimisticEvents`（read-time，D20 通道）

这些是 chip 视觉骨架改动，触发 H11 视觉契约。

## Requirement 4: 落点状态机与时间保持

平移只改日期部分，必须保留原 occurrence 的时分秒 + 时区 + 时长。

合法落点：同月另一日 / 跨月格 / 单日事件任意日 / 跨日事件以起始日锚平移 /
recurring occurrence 默认单次平移（scope 缺省，后端裁决）。

非法落点必须 fail-fast（见 Requirement 6）：

- drop 到非日期格 → 取消，无副作用
- drop 目标日 = 原始日 → no-op，不发请求

## Requirement 5: 键盘可达的改期替代路径（a11y）

拖拽不得是唯一改期入口。必须：

- 接入 `@dnd-kit/core` 的 `KeyboardSensor`（不止 `PointerSensor`）
- chip 聚焦后可用键盘进入移动模式，方向键预览落点，Enter 确认 / Esc 取消
- 落点变化通过 `aria-live=polite` 播报
- 对比度 / focus ring 满足 WCAG AA；vitest-axe 0 violation

## Requirement 6: Fail-Fast（H7）

以下点位默认抛错 / 显式回滚，禁 silent catch / fallback：

- 非日期格 drop → 取消，无副作用（禁猜最近日期）
- 时间计算异常 → 抛错不提交（禁 `?? 原值`）
- `detectEventConflicts` 失败 → 抛错 + 回滚乐观 patch（禁 silent 后照常提交）
- `useUpdateEvent` reject → `removeOptimisticEvent` 回滚 + 显式提示（禁乐观 patch 残留）
- recurring scope 缺省由后端裁决，前端禁伪造默认 scope

例外须代码旁 marker + `docs/engineering/fail-fast-exceptions.md` 登记。

## Requirement 7: 落点冲突校验

drop 提交前复用 `detectEventConflicts`（`POST /plans/events/conflicts`）。
返回 conflict 时不得自动提交；处理策略（硬阻断 vs 二次确认）在 design 阶段拍板。

## Requirement 8: 视觉契约（H11）

Runner Wave 0/1 前必须落 `docs/plan/sik-139-calendar-drag-drop-visual-contract.md`，
含七节标准结构，并被本 issue Acceptance 显式引用。至少覆盖：拖拽态 chip /
drop 目标格高亮 / 键盘移动模式态 / 冲突提示态。

## Requirement 9: Token SSOT

新增拖拽 / drop 高亮视觉只能消费 `packages/design-system/src/tokens.css` token；
禁止引入原型 var（`--paper-1` / `--ink-1` / `--r-card` / `--t-meta` / `--shadow-1`）
与 color-mix 百分比硬编码。

## Requirement 10: Commit / Review / Validation Gate

- commit：≤15 文件、≤400 净增、不混 plan/spec/impl/test
- review：跨写边界 wave + 视觉 wave 必须独立 subagent review → `docs/reviews/sik-139-w<N>.md`
- validation：实现 wave full（typecheck + lint + test + browser smoke 1440/1920）
