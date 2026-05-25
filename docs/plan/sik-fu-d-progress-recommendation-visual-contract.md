---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-25
issue: SIK-FU-D
multica-issue: SIK-90, SIK-91, SIK-92
parent-multica-issue: SIK-112
parent-issues: SIK-91, SIK-92
prototype:
  - .tmp_review/out/Tab1-Home/Home v2.1.html
---

# SIK-FU-D · ProgressSection / RecommendationCard 视觉契约（H11）

> 修复 SIK-91 / SIK-92 的卡片密度漂移：ProgressSection 缺 bar / RecommendationCard 缺图标 + 角标 + 视觉编码 / Calendar a11y role 错。

## 0. Scope

- **修复对象**：
  - `apps/web/src/views/Home/sections/ProgressSection.{tsx,module.css}`（Section B 底栏 #2）
  - `apps/web/src/views/Home/sections/RecommendationSection.{tsx,module.css}`（Section C 底栏 #3）
  - `apps/web/src/views/Home/sections/RecommendationCard.tsx`
  - `apps/web/src/views/Home/sections/{Today,Week,Month}CalendarView.tsx` 的 a11y role 修正（grid → row → cell）
- **不修复**：底栏 #1 weekly review（属 SIK-FU-A wave 3）；CalendarView 整体合并入单 panel（属 SIK-FU-A wave 2）
- **owner**：本契约 + Section B/C 卡密度收口 + Calendar a11y 修正

## 1. Layout Topology

ProgressSection 与 RecommendationSection 都是 Home 底栏 row 的子卡，由 SIK-FU-A 提供的 `bottomRow` 三列 grid 父级渲染。每个 section 在自己的 `<Panel>` 容器内：

```tsx
<Panel title="学习进度">
  <ProgressSection />
</Panel>
<Panel title="今日推荐" actions={<RefreshButton />}>
  <RecommendationSection />
</Panel>
```

容器高度由父 `bottomRow grid-template-rows: minmax(0, 1fr)` 提供；内部如果列表超过容器高度，走 `overflow-y: auto` 局部滚（与原型 `.weak-list / .feed-list` 一致）。

## 2. Required Interactive Elements

### 2.1 ProgressSection (Section B 底栏 #2)

原型映射：`Home v2.1.html` `.bottom-card` 第 2 格 "Top 3 弱项"。

| 元素 | 行为 |
|---|---|
| bc-head h4 "Top 3 弱项" | 静态 |
| bc-head a "弱项分析 →" | 跳 `/profile/learning`（active range = 30 天） |
| weak-item × 3 | 每行：name(90px ellipsis) + bar-track(flex 1, h:5px) + bar-fill(percent + err class when ≤50%) + val(36px tabular-nums right-align) |

数据源：`useProgressOverview().weaknessTop3`，每条用 `accuracy` 字段映射 bar 宽 + 数值。

### 2.2 RecommendationSection (Section C 底栏 #3)

原型映射：`Home v2.1.html` `.bottom-card` 第 3 格 "最近练习"——但 SIK-92 已把 Plan 层语义改为"今日推荐"。本 issue 沿用 SIK-92 语义但**复用原型 #3 的 feed 视觉骨架**。

| 元素 | 行为 |
|---|---|
| bc-head h4 "今日推荐" | 静态 |
| bc-head 刷新 icon-btn | `useRefreshRecommendations.mutate({})` |
| feed-item × N | 每条复刻原型 feed-item：feed-icon(24×24 圆角，按 actionType 染色) + feed-main(name + sub) + feed-pill(右侧角标，可点出 AcceptOptionMenu) |
| feed-item 整体可点 | 打开 AcceptOptionMenu（accept / reject 二选一）；不再用两个独立 Button |

actionType → 视觉编码：
- `practice-session` → `k-practice`：`--color-bg-elevated` 底 + `--color-text-primary` 边
- `mock-exam` → `k-mock`：`--color-bg-elevated` 底 + `--color-brand-primary` 边
- `review` → `k-review`：`--color-bg-elevated` 底 + `--color-state-info` 边
- `milestone` → `k-milestone`：`--color-state-err-soft` 底 + `--color-state-err` 边

feed-pill 右侧文字按推荐显示 `estimatedMinutes + '分'` 或 `sessionLength + '题'`。

### 2.3 Calendar a11y 修正

`WeekCalendarView` 当前 `role="grid"` 下直接放 `role="columnheader"` / `role="gridcell"`，axe 报错。修正为：

```html
<div role="grid">
  <div role="row">      <!-- 表头行 -->
    <div role="columnheader">周一</div>
    ...
  </div>
  <div role="row">      <!-- 数据行（按 hour 切片或单行容器） -->
    <div role="gridcell">...</div>
    ...
  </div>
</div>
```

`MonthCalendarView` 同样补 `role="row"` 中间层。

## 3. Information Density

### ProgressSection 每行 weak-item

3 视觉块：name + bar(track + fill) + val。**不再放 Badge**（原 SIK-91 实现的 Badge 在原型里没有）。

### RecommendationSection 每条 feed-item

3-4 视觉块：feed-icon (kind 染色) + feed-main(name + sub 时长/题数) + feed-pill (右侧角标)。整条 hover 高亮 + 点击触发 AcceptOptionMenu。

4 状态：
- loading → Skeleton ×3
- empty → 简短 EmptyState（不放大占位）
- error → 简短 EmptyState（用 description 带 error.message）
- ready → feed/weak 列表渲染

## 4. Token Map

| 原型 | V5 |
|---|---|
| `--paper-1 / -2 / -3` | `--color-bg-surface / -elevated / -sunken` |
| `--ink-1 / -2 / -3` | `--color-text-primary / -secondary / -meta` |
| `--ok / -50` | `--color-state-ok / -soft` |
| `--err / -50` | `--color-state-err / -soft` |
| `--info / -50` | `--color-state-info / -soft` |
| `--brand-yellow / -soft` | `--color-brand-primary / -soft` |
| `--r-pill` | `--radius-999` |
| `--r-tiny` | `--radius-10` |
| `--shadow-1` | `--shadow-l1` |

## 5. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| 底栏 #3 语义 | Home v2.1 是"最近练习" feed | 沿用 SIK-92 改的"今日推荐" + accept/reject | SIK-92 plan 层已拍板（不回滚） | 2026-05-24（SIK-92） |
| Recommendation accept 入口 | n/a（原型是 feed） | 整条 feed-item 可点出 AcceptOptionMenu，不再放 2 个 Button | 卡片密度更接近原型 feed | 2026-05-25 |
| Recommendation reject | SIK-92 acceptance 写「弹 RejectFeedbackDialog」 | 本 issue wave 3 落实（SIK-92 现注释里写"posts a fixed reason"是已知 drift） | 修复 SIK-92 的实现/acceptance drift | 2026-05-25 |
| Calendar a11y role | 原型无 role 属性 | 补 `role="row"` 中间层 | 修 WCAG AA + axe 0 violation | no drift |

## 6. Acceptance Hooks

| # | 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|---|
| D1 | Top 3 弱项 bar 视觉 | 1487-1518 | `ProgressSection.tsx` | ☐ |
| D2 | bc-head 跳转链接 | 1486 | `ProgressSection.tsx` Link | ☐ |
| D3 | feed-item 4 kind 染色 | 1521-1571 | `RecommendationCard.tsx` data-kind | ☐ |
| D4 | feed-item 整条 hover + click | 1535 | `RecommendationCard.tsx` button | ☐ |
| D5 | RejectFeedbackDialog 真实 reason 选择 + draft restore | n/a | `RejectFeedbackDialog.tsx` 完整实现 | ☐ |
| D6 | Week/Month a11y role 修正 | n/a | `vitest-axe` 0 violation | ☐ |
| D7 | 4 状态全覆盖 | n/a | vitest 用例 | ☐ |

Chrome MCP 双开 diff 截图归档到 `.tmp_review/visual-diff/sik-fu-d/`，重点截 Home bottomRow #2 + #3。

## 7. Wave Plan

- Wave 1: ProgressSection 改 bar 视觉（删 Badge / 加 bar）
- Wave 2: RecommendationCard 改 feed 视觉（kind 染色 + 整条点击 → AcceptOptionMenu）
- Wave 3: RejectFeedbackDialog 完整实现 + draft restore
- Wave 4: Week/Month a11y role 修正 + 4 状态测试

## 8. 参考

- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- 原型：`.tmp_review/out/Tab1-Home/Home v2.1.html`
