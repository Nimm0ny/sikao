---
type: feature
status: planned
owner: lhr
last-reviewed: 2026-05-29
notion-issue-url: https://www.notion.so/36fbc174f6c881ee9e7bdae2a9e3b29a
notion-issue-identifier: SIK-139
parent-issue: SIK-138
parent-issue-url: https://www.notion.so/36ebc174f6c88187840ac2623a1666f7
spec: .kiro/specs/sik-139-calendar-drag-drop/
depends-on: SIK-138
related: SIK-140, SIK-141, SIK-112
---

# Calendar Drag-Drop (Phase 3 / dnd-kit) Plan

> Define-First 立项文档（H6）。本文件只定义边界、复用面、wave 切分与验收骨架；
> 不含任何运行时实现。Runner 进场前以本文件 + spec 为准。

## 1. Why / 目标

SIK-138 V1 把 Home `CalendarPanel` 升级成 Notion-like 事件密度模型（read-only）。
Phase 3 在此之上解锁**月视图 chip 拖拽改期 / 改时段**：用户拖动 chip 到另一天
（或另一时段）即提交一次事件时间更新，配乐观渲染 + 失败回滚。

目标：

- 月视图 chip 支持拖拽到目标日 → 触发 `startAt/endAt` 平移更新
- 拖拽过程乐观渲染（复用 `usePlanStore.optimisticEvents`），失败显式回滚
- 落点前做冲突校验（复用 `detectEventConflicts`）
- 提供键盘可达的改期替代路径（拖拽不是唯一入口）

## 2. 非目标（明确不做）

- ❌ inline 字段编辑（title / notes / props）—— 属 SIK-140 / Phase 4
- ❌ 聚合属性（练习数 / 准确率）—— 属 SIK-141
- ❌ 周视图 / 今日视图内的时间轴拖拽 resize（仅月视图改日；周/今日 resize 列为 V2 follow-up）
- ❌ recurring 事件的「整条 series 改期」复杂 UI（V1 仅支持 `scope` 透传，默认单次 occurrence；series 编辑沿用 SIK-138 既有约束）
- ❌ 新建事件拖拽（仅移动既有事件）

## 3. 复用清单（不要重造）

> H1 重要：以下两项在 SIK-138 父 issue body 被标记为「已留位」，但经 2026-05-29
> 代码核查**并未落地**，必须在本 Phase 的 Wave 0 补齐，不得假设已就绪。详见 §9。

| 复用项 | 现状（2026-05-29 核查） | 用途 |
|---|---|---|
| `@dnd-kit/core@^6.3.1` | 已装未用（`apps/web/package.json`） | DnD context / sensors |
| `@dnd-kit/sortable@^8.0.0` | 已装未用 | 备用，本 Phase 主用 core |
| `usePlanStore.optimisticEvents` | ✅ 存在（`ReadonlyMap<string, OptimisticEventPatch>`，`packages/domain/src/plan/usePlanStore.ts`） | 拖拽乐观 patch 落点 |
| `usePlanStore.upsertOptimisticEvent / removeOptimisticEvent / resetOptimisticEvents` | ✅ 存在 | 乐观写入 / 回滚 |
| `useUpdateEvent(eventId, options)` | ✅ 存在（`packages/api-client/src/plansMutations.ts`），`PATCH /plans/events/{id}` | 改期提交 |
| `detectEventConflicts` | ✅ 存在（`POST /plans/events/conflicts`） | 落点冲突校验 |
| `calendarEvents.ts`（`expandPlanEventsForView` / `sliceMonthOccurrencesByDay`） | ✅ 存在 | 拖拽后重算 occurrence 渲染 |
| `MonthEventChip` chip 锚点 `data-event-id` / `data-peek-anchor` | ❌ **不存在**（仅 `data-testid` / `data-kind` / `data-cross-day`） | Wave 0 必须补 |

## 4. 稳定边界定义（H6 · Define-First）

### 4.1 Mutation API 契约（复用既有端点，不新增端点）

拖拽改期复用 SIK-138 已有写边界，**不新增后端端点**：

- 端点：`PATCH /plans/events/{eventId}`
- 请求 DTO：`PlanEventUpdateRequestV2`（`packages/api-client/src/types/api.generated.ts`）
  - 拖拽改期只提交时间字段子集：
    - `startAt?: string | null`
    - `endAt?: string | null`
  - 其余字段（title / notes / category / status / targetId）**不在拖拽 payload 内**
- recurring 作用域：`options.scope?: string`（`RecurringScopeConfig`）
  - V1 默认不带 scope（= 单次 occurrence 语义，由后端裁决）
  - series 级改期不在 Phase 3 范围
- 客户端 hook：`useUpdateEvent(eventId, { scope? })`

### 4.2 乐观更新 patch 形状

拖拽 drop 瞬间，先写乐观 patch，再发请求：

```text
onDragEnd(eventId, dropTargetDate):
  1. 计算 nextStartAt / nextEndAt（保持原时长，平移到 dropTargetDate）
  2. usePlanStore.upsertOptimisticEvent(eventId, { startAt: nextStartAt, endAt: nextEndAt })
  3. await useUpdateEvent(eventId).mutateAsync({ startAt, endAt })
     - 成功：removeOptimisticEvent(eventId)（让 invalidate 后的真实数据接管）
     - 失败：removeOptimisticEvent(eventId) 回滚到拖拽前 + 显式抛错 / 提示（见 §6）
```

patch 类型沿用 store 既有 `OptimisticEventPatch = Partial<PlanEventReadV2>`，
**不新增 store 字段、不新增 store 形状**。chip 渲染层在 month occurrence 投影前
merge `optimisticEvents.get(event.id)`（这是 SIK-138 D20 预留的 read-time merge 通道）。

> 注意：SIK-138 W5 实现中 `MonthEventChip` 当前**未** merge optimisticEvents
> （父 issue 标了 `[x]` 但代码核查未落地，见 §9）。本 Phase Wave 0 需补 merge 通道。

### 4.3 事件状态机 / 落点迁移

拖拽落点的合法迁移：

| 起点 | 落点 | 行为 | 校验 |
|---|---|---|---|
| 月视图某日 chip | 同月另一日 | 平移 `startAt/endAt`（保持时长 + 时分 + 时区） | 落点冲突 detect |
| 月视图某日 chip | 跨月格（grid 溢出日） | 同上（日期跨月合法） | 落点冲突 detect |
| 单日事件 | 任意日 | 单日平移 | detect |
| 跨日事件（cross-day slice） | 任意日 | 以 occurrence 起始日为锚平移整段 | detect |
| recurring occurrence | 任意日 | 默认单次 occurrence 平移（scope 缺省） | detect + recurring 边界提示 |

非法落点（必须 fail-fast，不 silent catch）：

- drop 到非日期格（grid gutter / header）→ 取消拖拽，不发请求，无副作用
- `detectEventConflicts` 返回 conflict → 不自动提交；按 §6 决策（阻断或二次确认，拍板见 spec）
- drop 目标日 = 原始日 → no-op，不发请求

时间保持规则：平移只改「日期部分」，**保留原 occurrence 的时分秒 + 时区 + 时长**。
跨时段（改时分）不在月视图拖拽范围，列为周/今日视图 follow-up（§2 非目标）。

## 5. a11y：键盘可达的改期替代路径

拖拽不能是唯一改期入口（NF-A11y，`docs/vault/05-migration/Phase/Home/00-Decisions.md`
日历键盘可操作要求）。本 Phase 必须同时提供：

- chip 聚焦后键盘改期：`Enter` 进入「移动模式」，方向键按日步进预览落点，`Enter` 确认 / `Esc` 取消
- 或复用 Peek 卡片（SIK-138 已有）作为非拖拽改期入口的承载（具体入口在 spec 设计阶段二选一拍板）
- `@dnd-kit/core` 的 `KeyboardSensor` 必须接入（dnd-kit 原生支持键盘拖拽），不得只接 `PointerSensor`
- 拖拽中目标格需有可感知的 focus / aria-live 反馈，落点变化通过 `aria-live=polite` 播报
- 对比度 / focus ring 满足 WCAG AA

> WCAG 完整达标需人工辅助技术验证 + 专家评审；本 Phase 仅承诺键盘可达 + axe 0 violation +
> 手动键盘走查，不声称完整 WCAG 认证。

## 6. Fail-Fast 点（H7）

| 点位 | 行为 | 禁止 |
|---|---|---|
| 落点校验 | 非日期格 drop → 取消，无副作用 | 禁止猜一个最近日期 silent 落点 |
| 时间计算 | nextStartAt 计算失败（解析异常）→ 抛错，不提交 | 禁 `?? 原值` 掩盖计算 bug |
| 冲突检测 | `detectEventConflicts` 网络/解析失败 → 抛错 + 回滚乐观 patch | 禁 silent catch 后照常提交 |
| mutation 失败 | `useUpdateEvent` reject → `removeOptimisticEvent` 回滚 + 显式错误提示 | 禁 silent catch；禁乐观 patch 残留 |
| recurring scope 缺省 | 后端按单次裁决；前端不自行决定 series 语义 | 禁前端伪造 scope 默认值 |

所有 fail-fast 例外（若 spec 阶段确需）必须：代码旁 marker 注释 +
`docs/engineering/fail-fast-exceptions.md` 登记。立项阶段默认零例外。

## 7. Wave 拆分建议 + 每 wave gate

| Wave | 内容 | Review Gate | Validation Gate |
|---|---|---|---|
| Wave 0 | spec 落档（requirements + design）+ 补 SIK-138 遗留锚点（`data-event-id` / `data-peek-anchor` + chip optimistic merge 通道） | docs/spec：>50 行新增触发独立 review；锚点改动属 chip 视觉骨架 → H11 视觉契约 | scoped（typecheck + 相关测试） |
| Wave 1 | dnd-kit DndContext + PointerSensor/KeyboardSensor 接入月视图（仅拖拽骨架，drop = no-op 占位） | 独立 subagent review（前端视觉 phase，H5/H11） | typecheck + lint + 单测 + browser smoke 1440/1920 |
| Wave 2 | drop → 时间平移计算 + 乐观 patch + `useUpdateEvent` 提交 + 回滚 | 独立 review（跨写边界，H5） | full：typecheck + lint + test + browser smoke |
| Wave 3 | 落点冲突校验（`detectEventConflicts`）接入 + 冲突 UX 拍板落地 | 独立 review | full validation |
| Wave 4 | a11y 键盘改期路径 + aria-live + axe 0 violation + 验收 hook closeout | 独立 review + 规范审查官 | full validation + 双开 diff 截图归档 |

每个跨写边界 / 视觉 wave 的 review 报告落 `docs/reviews/sik-139-w<N>.md`。
commit 切分遵守 H9：≤15 文件、≤400 净增、不混 plan/spec/impl/test。

## 8. Acceptance Hooks 骨架

- [ ] spec（requirements + design）落 `.kiro/specs/sik-139-calendar-drag-drop/`，被本 issue Acceptance 引用
- [ ] Wave 0 补齐 `data-event-id` + `data-peek-anchor` 锚点 + chip optimisticEvents merge 通道（H1 遗留修复）
- [ ] 视觉契约 `docs/plan/sik-139-calendar-drag-drop-visual-contract.md` 落档（H11，拖拽态 / drop 高亮 / 键盘移动态）
- [ ] dnd-kit DndContext + PointerSensor + KeyboardSensor 接入月视图
- [ ] drop 改期：乐观 patch → `PATCH /plans/events/{id}` → 成功清乐观 / 失败回滚（Fail-Fast）
- [ ] 落点冲突校验接 `detectEventConflicts`，冲突按拍板 UX 处理（不 silent 提交）
- [ ] 键盘改期替代路径可达（KeyboardSensor + 方向键预览 + Enter/Esc）
- [ ] `pnpm typecheck + lint + test` 全 PASS
- [ ] 1440 / 1920 双开 Chrome MCP，拖拽 / drop / 键盘改期 三态截图归档
- [ ] vitest-axe 0 violation
- [ ] 独立 subagent review 报告落 `docs/reviews/sik-139-w<N>.md`（Wave 1-4 各一）
- [ ] Evidence Block 回写 issue body + Work Log Type=Evidence

## 9. 与 SIK-138 现状的 drift（H1 必读）

立项核查（2026-05-29，基于 main HEAD `7fbf18a82`）发现 SIK-138 父 issue body
两处「已留位」声明与代码现状不符，本 Phase 必须把它们当作**待补**而非**已就绪**：

1. **`data-event-id` / `data-peek-anchor` 锚点缺失**
   - 父 issue body：「chip 加 `data-event-id + data-peek-anchor`，Phase 3 拖拽直接消费」，Acceptance 打 `[x]`
   - 代码核查：`apps/web/src/views/Home/sections/MonthEventChip.tsx` 仅有 `data-testid` / `data-kind` / `data-cross-day` / `data-kind-disabled`；全仓 `grep data-event-id` / `data-peek-anchor` 在 `apps/web/src` **0 命中**
   - 处置：Wave 0 补锚点，不假设已存在
2. **chip 未 merge `optimisticEvents`**
   - 父 issue body：「chip 渲染时 merge `usePlanStore.optimisticEvents` patch」，Acceptance 打 `[x]`
   - 代码核查：`MonthEventChip` / `MonthCalendarView` 均未读取 `optimisticEvents`（仅 `AcceptOptionMenu` 用 `upsertOptimisticEvent` 写）
   - 处置：Wave 0 补 read-time merge 通道（store 形状已就绪，无需改 store）
3. **「Requirement 19」不存在**
   - 父 issue + 本任务背景：「inline 编辑契约 Requirement 19 已前置定义于 requirements.md」
   - 核查：`.kiro/specs/sik-138-home-calendar-v2/requirements.md` 只到 **Requirement 15**；inline 编辑在 design.md 是明确 Non-goal
   - 处置：该 drift 影响 SIK-140，不影响 SIK-139；已在 SIK-140 issue body 记录，Phase 4 须从零定义 inline 契约

这三点不阻塞 Phase 3 立项，但**阻塞「钩子全预留、0 成本」这个乐观假设**——
实际 Phase 3 起步要先还 SIK-138 的锚点债（Wave 0）。

## 10. Rollback

- Wave 0 锚点补齐可独立 revert（纯 chip data 属性 + read merge，无行为变更）
- Wave 1 DndContext 可独立 revert（drop 为 no-op，无写副作用）
- Wave 2+ 改期写路径 revert 回到 read-only 月视图，不影响 SIK-138 V1 既有渲染

## 11. Next Owner

- Master：spec 落档把关 + 冲突 UX 拍板（Wave 3 阻断 vs 二次确认）+ 键盘入口二选一拍板
- Runner：Wave 0-4 实现
- Verifier：双开 browser 验收 + axe + Evidence
