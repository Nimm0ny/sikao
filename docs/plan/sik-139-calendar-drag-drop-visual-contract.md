---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-29
notion-issue-url: https://www.notion.so/36fbc174f6c881ee9e7bdae2a9e3b29a
notion-issue-identifier: SIK-139
spec: .kiro/specs/sik-139-calendar-drag-drop/
plan: docs/plan/sik-139-calendar-drag-drop-plan.md
prototype-baseline: .tmp_review/out/Tab1-Home/Home Month Calendar v1.html
token-derivation-approved-by: lhr (2026-05-29)
---

# SIK-139 Calendar Drag-Drop Visual Contract (H11)

> H11 Define-First 视觉契约。Phase 3 拖拽交互态**无独立原型**（月视图原型只有静态
> 布局 + DayDetailDialog）。经 lhr 2026-05-29 认可，本契约以
> **"扩展 Design-System §B `dragging` 态 + 复用 `--color-focus-ring` / `--cal-*`
> token 推导 drop / keyboard 态"** 为基准；原型对照表仅覆盖静态月视图布局不回归，
> 交互态走 token 推导 + 实现即契约。
>
> 本契约覆盖 SIK-139 全 Phase 的视觉边界。Wave 0 仅落 chip 锚点 + optimistic
> 渲染通道（无新增可见像素）；Wave 1-4 的拖拽 / drop / 键盘 / 冲突态据本契约实现。

## 0. Scope 分层

| Wave | 可见视觉变化 | 契约约束来源 |
|---|---|---|
| Wave 0 | 无（仅 `data-event-id` / `data-peek-anchor` 属性 + optimistic 渲染 merge） | §3 信息密度不回归 |
| Wave 1 | dragging chip 态 | §1 §2 §4（Design-System §B dragging 推导） |
| Wave 2 | drop-target 日格高亮（可见）+ 乐观 patch（状态层，月视图 chip 不显示时间故无可见位移，落位以 refetch 为准） | §4（focus-ring / cal token 推导） |
| Wave 3 | 冲突确认层 | §2 §4（复用 Peek scrim / dialog token） |
| Wave 4 | keyboard-move 预览态 + aria-live | §4（focus-ring 推导）+ §2 a11y |

## 1. Layout Topology

拖拽不改月视图 root 拓扑（沿用 SIK-126 / SIK-138）：

- root：`MonthCalendarView` → `dowRow`（sticky head）+ `bodyScroll`（局部滚，3 行视口）
- grid：7 列 × 6 行 = 42 cell；cell 内 `dom` 数字 + `eventList`（≤ `cardLimitPerCell` chip + `+N 更多`）
- 一屏行为：`ScreenLockShell` 锁死，月视图 body 局部滚（Web-Layout 一屏锁死规则不变）
- 子区域 owner：
  - `MonthCalendarViewBody` — 数据 / config / store 订阅
  - `MonthGrid` — cell 渲染 + peek list scope + （Phase 3）DndContext droppable
  - `MonthEventChip` — chip 表面 + （Phase 3）draggable handle

拖拽**不引入**新的滚动容器 / 浮层布局；drop-target 高亮是 cell 内态，不改 grid 几何。

## 2. Required Interactive Elements

拖拽 Phase 必须存在（不能少）：

- 每个 `MonthEventChip` 是可拖拽 handle（`useDraggable`），同时保留 onClick 开 Peek
- 每个日 `cell` 是 drop target（`useDroppable`，key = `cell.stamp`）
- 键盘改期入口：chip 聚焦后 `Space`/`Enter` 进入移动模式（KeyboardSensor）
- 移动模式下方向键步进 + `Enter` 确认 / `Esc` 取消
- 冲突确认层（Wave 3）：确认 / 取消两按钮，列出冲突事件
- aria-live region（polite）播报候选落点 + 冲突态

不得移除 SIK-138 既有元素：chip onClick → Peek、`+N 更多` overflow、cell 数字 / today 标记。

## 3. Information Density

chip 信息密度沿用 SIK-138 W5（visual contract §3 七通道），Phase 3 **不增删通道**：

- chip 元素数不变：kind 边色 + title + （按 preset）category / status dot / source icon / link icon / target badge
- 拖拽态**不新增持久可见元素**；dragging / drop 高亮是**瞬态视觉**（拖拽结束即消失）
- 乐观预览：optimistic patch 改的是既有通道的值（如 title / status），不加新通道。
  注（W2 review L-3）：W2 改期 patch 写的是 `startAt/endAt`，但月视图 chip 不渲染时间、
  也不按 optimistic 重投影到目标格，故 W2 改期在月视图**无可见乐观位移**；真实落位以 PATCH
  成功后的 refetch 为准。可见的乐观时间预览需 chip 显示时间或落格重投影，属后续增强。
- recurring 拖拽轻提示"仅改这次"：瞬态 tooltip/inline hint，非持久 chip 元素

密度不回归判据：拖拽前后静态 chip 的 DOM 元素数 / 视觉编码与 SIK-138 W5 完全一致。

## 4. Token Map（原型 var → V5 token；交互态走 token 推导）

静态布局（原型对照，不回归）：

| 用途 | V5 token | 说明 |
|---|---|---|
| chip kind 边色 | `--cal-kind-{plan,practice,mock,milestone}` | SIK-138 §8.1，不变 |
| chip 圆角 / 边宽 / tint | `--cal-chip-radius` / `--cal-chip-border-w` / `--cal-chip-tint-alpha` | SIK-138 §8.2，不变 |
| status dot | `--cal-status-dot-size` | 不变 |

交互态（无原型，token 推导 — lhr 已认可）：

| 交互态 | 推导 token | 推导规则 |
|---|---|---|
| dragging chip | `--shadow-l2`（= 原型 `--shadow-2` card-hover）+ 既有 `--cal-chip-*` | Design-System §B `dragging` 态：抬升一层阴影 + 轻微透明度，几何不变 |
| drop-target cell 高亮 | `--color-focus-ring` + `--color-state-info-soft` | focus-ring 描边 + info-soft 底色（复用既有 focus / info 语义，不新建色） |
| keyboard-move 预览 cell | `--color-focus-ring`（实线描边，区别于 hover drop 的虚线） | 与 drop-target 同色不同描边样式，键盘态显式可感知 |
| 冲突确认层 | `--cal-peek-scrim` + `--shadow-l4` + `--radius-14` | 复用 Peek/dialog 既有 scrim + modal 阴影 token |
| 乐观预览 chip | 既有 `--cal-*`（值变、token 不变） | 渲染 merge，不改视觉 token |

**禁止**：原型 var 直写（`--paper-1` / `--ink-1` / `--r-card` / `--t-meta` / `--shadow-1`）、
color-mix 百分比硬编码、新建一次性颜色。新增 drag token 若不可避免，必须落
`--cal-drag-*` 家族进 `tokens.css`（单源），不得散落组件。

## 5. SSOT Conflicts

| 项 | 原型默认 | 当前 SSOT 默认 | 采用 | 拍板 |
|---|---|---|---|---|
| Phase 3 交互态视觉 | 原型无 | Design-System §B 有 `dragging` 态词表 + focus-ring/cal token | **SSOT（token 推导）** | lhr 2026-05-29 |
| drop 反馈色 | 原型无 | `--color-focus-ring` / `--color-state-info-soft` 已定义 | **SSOT 既有色** | lhr 2026-05-29 |
| 冲突层承载 | 原型 DayDetailDialog（点格展开） | Peek dialog token 已存在 | **复用 Peek/dialog token**（非 DayDetailDialog） | lhr 2026-05-29 |

无与 Design-System / Web-Layout 的未决冲突；一屏锁死规则不变。

## 6. Visual Drift from Prototype

- 月视图静态布局：**no drift**（沿用 SIK-126 / SIK-138 已验收布局）
- Phase 3 交互态：原型缺失，**全部为 token 推导新增**，不构成"偏离原型"（无原型可偏离），
  已在 §4 §5 记录推导依据 + lhr 拍板
- 冲突层不复用原型 DayDetailDialog 视觉（改用 Peek/dialog token）：声明性偏离，理由 = 原型
  DayDetailDialog 是"点格展开当日详情"的只读浮层，与"改期冲突确认"语义不同，复用会误导

## 7. Acceptance Hooks（实现 vs 基准对照表）

> Wave 0 仅前两行可勾（无可见像素）；交互态行在对应 Wave 实现后由 Chrome MCP 双开
> （1440 / 1920）截图对照，PASS / 偏离 归档到 `.tmp_review/out/sik-139-w<N>/`。

| 项 | 基准 | 实现 | 状态 |
|---|---|---|---|
| 静态月视图布局不回归 | SIK-138 W5 chip + grid | chip DOM 元素数/编码不变（Wave 0 已验：14+10 测试 PASS） | PASS (W0) |
| chip 锚点 | `data-event-id`=真实 id / `data-peek-anchor`=per-slice | 已实现 + 单测 4 条 PASS | PASS (W0) |
| optimistic 渲染 merge | D20 read-time placeholder | `{...event,...patch}` 渲染 + 集成测试 PASS | PASS (W0) |
| dragging chip 态 | §4 `--shadow-l2` 抬升 | `.chip[data-dragging]` lift `--cal-drag-shadow`(=`--shadow-l2`)+`--cal-drag-opacity`，几何不变；1440/1920 双开实测 PASS | PASS (W1) |
| drop-target 高亮 | §4 focus-ring + info-soft | `.cell[data-drop-over]` outline(`--cal-drop-ring`)+fill(`--cal-drop-fill`)，inset outline 不挪几何 | PASS (W2) |
| keyboard-move 预览 | §4 focus-ring 实线 | `.cell[data-keyboard-over]` inset focus ring（`--cal-keyboard-ring`=focus-ring，单源），键盘拾起后 over cell 显式预览描边；自定义 `KeyboardCoordinateGetter` 按日/周步进；1440/1920 双开 Chrome MCP 实测 PASS | PASS (W4) |
| 冲突确认层 | §4 peek-scrim + shadow-l4 | `ConflictConfirmDialog` portal + FocusTrap + Esc/scrim/cancel → onCancel（无副作用）；detect 非空 conflicts → 列冲突弹层 → 确认走 `runCommit`(=W2 `commitReschedule`) / 取消无 store 写无 PATCH；detect 请求失败 → `runConflictGate` onError → toast 不提交（H7 三分支隔离）。token 全走 `--cal-peek-scrim`/`--shadow-l4`/`--cal-peek-radius`，按钮复用 `Button`。单测 dialog 8（含 axe 0 violation）+ guard 8 + gate 4 + proposed 4 PASS；1440/1920 双开 diff 待 Verifier | PASS (W3, 代码级)；双开 diff 待 Verifier |
| aria-live 落点播报 | §2 polite | `buildRescheduleAnnouncements` 注入 `<DndContext accessibility={{ announcements }}>`：拾起/落点变化（候选日期）/确认/取消四回调中文播报，over=null 不播报；1440/1920 双开实测 aria-live 逐键更新 PASS | PASS (W4) |
| drop → reschedule（乐观+PATCH+回滚） | Requirement 1/4/6 | rescheduleEvent 纯函数 + resolveCalendarDrop + useRescheduleEvent；optimistic upsert → PATCH → 成功清/失败回滚+toast；单测 21 PASS | PASS (W2) |
| 1440 / 1920 双开 diff | 交互三态截图 | W2 drop-over 高亮 + 跨日改期成功落位 + 失败回滚 toast + 键盘拾起，1440/1920 双开 Chrome MCP 实测归档 `.tmp_review/out/sik-139-w2/`（drag-dropover / reschedule-success / reschedule-fail-toast / keyboard-pickup × 1440+1920） | PASS (W2) |

## 8. Closeout

- Wave 0（已交付）：静态不回归 + 锚点 + optimistic 通道三项 PASS，无可见像素变化，
  无需 Chrome MCP diff（布局零改动）。交互态契约已锁，待后续 Wave 按 §4 token 推导实现。
- Wave 1（本提交）：dragging chip 态实现（`--cal-drag-*` 单源 token，`--shadow-l2`
  抬升 + opacity，几何不变；`prefers-reduced-motion` 降级保留抬升）。drop-target
  `data-drop-over` hook + KeyboardSensor + aria-live 播报已接（drop=no-op）。1440/1920
  双开 Chrome MCP 截图归档 `.tmp_review/out/sik-139-w1/`（month-rest / month-dragging /
  month-drag-move / month-click-peek）。§7 对照表回填：dragging chip 态 PASS。
- 后续每个交互 Wave 必须回填 §7 对照表 + 归档双开截图，并在 issue Acceptance 勾选。
- Wave 2（本提交）：drop → reschedule 落地。`rescheduleEvent`（纯函数，整日平移保留
  时分/时长/tz）+ `resolveCalendarDrop`（cancel / noop / reschedule 决策，Requirement 4/6）
  + `useRescheduleEvent`（复用既有 `PATCH /plans/events/{id}`，Requirement 1）。drop 编排：
  optimistic `upsertOptimisticEvent` → PATCH → 成功 `removeOptimisticEvent`（refetch 接管）
  / 失败回滚 + `toast.error`（H7，无 silent catch）。drop-target 高亮 `.cell[data-drop-over]`
  落地（`--cal-drop-ring` / `--cal-drop-fill`，inset outline 不挪几何）。单测 21 PASS
  （rescheduleEvent 7 + resolveCalendarDrop 5 + MonthGridDnd 7 + sensors 2）。
  Browser smoke：实际拖拽→改期落位的 1440/1920 双开复测留给 Verifier（headless 难稳定驱动
  dnd-kit drop，Runner 不伪造未跑的 smoke）。冲突确认层（Wave 3）+ 键盘完整改期路径（Wave 4）未做。
- Wave 2 Verifier closeout（browser smoke，2026-05-29）：dev server `127.0.0.1:18080`，
  Chrome DevTools MCP 在 **1440** + **1920** 双视口实测 Home 月视图 drop → 改期，8 个交互态
  逐条 PASS（drop-target XHR 受控 harness 仅拦 `/plans/events`，无运行时代码改动）：
  1. 拖起态：chip `data-dragging=true` + 抬升阴影（`--cal-drag-shadow`=`--shadow-l2`）+ `opacity 0.85`，几何不变。
  2. drop-target 高亮：目标日格 `data-drop-over=true`，`outline 2px solid rgb(43,108,255)`（`--cal-drop-ring`=focus-ring）+ 底色 `rgb(229,238,255)`（`--cal-drop-fill`=info-soft），inset 不挪几何。
  3. 跨日 drop 改期成功：`PATCH /plans/events/{id}` payload **仅** `{startAt,endAt}`（`2026-05-30T00:00:00.000Z`/`...02:00:00.000Z`，整日平移保 2h 时长，无 title/notes/status 夹带）→ 成功 refetch，chip 落到 day 30。
  4. 同日 drop：drop 回原格 → `patchCount=0`（no-op，无请求）。
  5. 非格子 drop：拖到 grid 外（header 区，`data-dropOver` 始终为 0）→ `patchCount=0`，chip 原位、无副作用。
  6. 失败回滚：harness 强制 PATCH 500 → `toast.error`「改期失败 · 「行测套卷模考」未能改期，请重试」+ chip 回滚原日（乐观 patch 无残留）。
  7. 键盘改期：chip 聚焦 → Space 拾起（`data-dragging` + aria-live 播报）→ ArrowRight 跨格（aria-live 更新到 2026-05-30）→ Enter 落下走**同一**改期路径（`PATCH {startAt,endAt}` → 落格）；Esc 取消则 `patchCount=0` 无副作用。
  8. a11y/控制台：拖拽全程 dnd-kit `role=status` aria-live 有播报；仅有的 2 条 console error 是 #6 强制失败路径的预期日志（`api.request.failed` / `react-query.mutation.error`，500），无意外报错。
  截图归档 `.tmp_review/out/sik-139-w2/`（`month-rest` / `drag-dropover` / `reschedule-success` /
  `reschedule-fail-toast` / `keyboard-pickup`，1440 + 1920 各一套，gitignored）。§7「1440/1920 双开 diff」
  行回填 PASS (W2)。结论：W2 validation gate 完整（代码级 25+154+13 PASS + browser smoke 8 态 PASS）。
  注（契约 §0 L-3 已声明边界，非 bug）：月视图 chip 不显示时间、不按 optimistic 重投影到目标格，
  故乐观改期**无可见位移**；可见落位以 PATCH 成功后 refetch 为准，已逐条以受控成功/失败路径验证。
- Wave 3（本提交）：落点冲突校验 + 二次确认弹层。新增 `conflictGuard`（`detectEventConflicts` 纯网络封装
  + UTC→Asia/Shanghai date 窗口映射，H6/H7）+ `proposedEvent`（构造 `ProposedPlanEventV2`）+
  `runConflictGate`（clear/conflict/error 三分支严格隔离，H7 红线）+ `ConflictConfirmDialog`（portal +
  FocusTrap + Esc/scrim/cancel + 列冲突 + 确认/取消，复用 Peek a11y 套路 + Peek/dialog token，H11）。
  drop 编排接缝：`resolveCalendarDrop` 得 reschedule decision 后、`commitReschedule` 之前插 conflict gate；
  无冲突 → 直接 commit（W2 不变）/ 有冲突 → 开弹层（确认走同一 `commitReschedule`，取消无副作用）/
  detect 请求失败 → toast + 不提交（绝不当无冲突放行）。W2 核心编排零改动。单测 W3 新增 22
  （conflictGuard 8 + proposedEvent 4 + runConflictGate 4 + ConflictConfirmDialog 8 含 axe 0 violation），
  dragDrop 合计 47 PASS，Home 175 不回归。typecheck / eslint / lint-hardcode/shadow/zindex/screen-lock /
  a11y 13 全 PASS。§7「冲突确认层」行回填 PASS (W3, 代码级)。
  Browser smoke：真实拖拽→冲突→弹层→确认/取消 的 1440/1920 双开复测留给 Verifier（headless 难稳定驱动
  dnd-kit drop，Runner 不伪造）。键盘完整改期路径（Wave 4）+ grid/gridcell ARIA 修（Wave 4 既有债）未做。
- Wave 4（本提交）：键盘完整改期路径 + aria-live + grid ARIA 修 + 验收 closeout。
  键盘引擎 `keyboardReschedule.ts`（纯模块）：自定义 `KeyboardCoordinateGetter`
  `stepDayCoordinate` 按**日**（左右）/**周**（上下）步进，锚定到 over/包含 chip
  的 cell rect（非 chip rect，`6ddd89da2` 修了 browser smoke 发现的「ArrowRight
  误跳下周」bug）；`buildRescheduleAnnouncements` 中文 aria-live 四回调。接线：
  `useCalendarDragSensors` 注入 getter，`DndContext` 注入 announcements。键盘
  Enter 确认走**同一** `onDragEnd → resolveCalendarDrop → gateRescheduleDrop`
  （绑定 W3 `runConflictGate`）→ 无冲突 `commitReschedule` / 有冲突
  `ConflictConfirmDialog` / detect 失败 toast 不提交——与拖拽路径同一编排，零新增
  提交路径。keyboard-move 预览 `.cell[data-keyboard-over]`（`--cal-keyboard-ring`
  inset ring，单源 token，§4）。grid/gridcell ARIA 修（W1 Low / W2 M-2 既有债收口）：
  单 `role="grid"` 包 `dowRow(role=row)` + `rowgroup>row>gridcell`，**MonthGridDnd
  与静态 MonthGrid fallback 两处一致**，`display:contents` 零布局位移。F-3 收口：
  抽 `gateRescheduleDrop` seam + 组件级集成测试。单测 dragDrop 73 PASS（W3 基线 47，
  +26：keyboardReschedule 19 + gateRescheduleDrop 4 + MonthGridAria 2 + sensor +1）；
  Home 202 PASS（不回归，W3 基线 175）；typecheck / eslint / lint-hardcode/shadow/
  zindex/screen-lock / a11y 13（vitest-axe 0 violation，新增月视图 grid axe 用例真覆盖
  ARIA 修）全 PASS。§7 回填：keyboard-move 预览 = PASS (W4)、aria-live 落点播报 =
  PASS (W4)。Browser smoke：**本 Wave 真做**（dev 127.0.0.1:18080 + Chrome DevTools
  MCP 1440/1920 双开）：键盘拾起 aria-live「已移动到 5月29日」+ keyboard-over 预览 →
  ArrowRight=+1日(5-30)/ArrowDown=+1周(6-06) → Enter 无冲突走同一路径 PATCH
  `{startAt,endAt}` only / 有冲突开 ConflictConfirmDialog → 仍然改期 commit / Esc
  「已取消改期」无 PATCH；真实指针拖拽→冲突→弹层→确认 PATCH 复测 PASS。截图归档
  `.tmp_review/out/sik-139-w4/`（month-rest / keyboard-preview / keyboard-conflict-dialog
  / drag-conflict-dialog，1440+1920，gitignored）。独立 subagent review pass
  （`docs/reviews/sik-139-w4.md`，0 High/Medium/Low + 3 Info，9 条自跑验证全 PASS）。
  W4 是 SIK-139 最后一个 wave，全 Acceptance 满足。
