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
| keyboard-move 预览 | §4 focus-ring 实线 | KeyboardSensor 接入 + aria-live 播报实测；预览描边待 Wave 4 | 部分 (W1 sensor) |
| 冲突确认层 | §4 peek-scrim + shadow-l4 | — | 待 Wave 3 |
| aria-live 落点播报 | §2 polite | — | 待 Wave 4 |
| drop → reschedule（乐观+PATCH+回滚） | Requirement 1/4/6 | rescheduleEvent 纯函数 + resolveCalendarDrop + useRescheduleEvent；optimistic upsert → PATCH → 成功清/失败回滚+toast；单测 21 PASS | PASS (W2) |
| 1440 / 1920 双开 diff | 交互三态截图 | W1 dragging/drop-move/click-peek 归档；W2 drop-over 高亮 + 改期落位待 Verifier 双开复测 | 待 Verifier (W2) |

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
