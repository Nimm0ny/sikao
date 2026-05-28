---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-25
issue: SIK-FU-A
multica-issue: SIK-90
parent-multica-issue: SIK-112
parent-issues: SIK-90
prototype:
  - .tmp_review/out/Tab1-Home/Home v2.1.html
  - .tmp_review/out/Tab1-Home/Home Today Calendar v1.html
  - .tmp_review/out/Tab1-Home/Home Week Calendar v1.html
  - .tmp_review/out/Tab1-Home/Home Month Calendar v1.html
---

# SIK-FU-A · Home 视觉契约（H11）

> 修复 SIK-90 视觉漂移：一屏锁死失败 / Calendar 双 head 嵌套 / 缺翻页与 +新建按钮 / bottomRow #1 占位 PLACEHOLDER_TASKS。

## 0. Scope 总览

- **修复对象**：`apps/web/src/views/Home/**` + `apps/web/src/layouts/RootLayout/**` 中的 AppShell / Workspace 高度模型
- **不修复**：Section B `ProgressSection`（属 SIK-FU-D）、Section C `RecommendationSection`（属 SIK-FU-D）
- **owner**：本契约 + AppShell 高度链 + Calendar 单 panel + bottomRow #1 由本 issue 收口

## 1. Layout Topology

### 1.1 AppShell 父链（必须先改）

原型 `.app { width: 100vw; height: 100vh; display: flex; overflow: hidden }`。

```css
/* AppShell.module.css 升级目标 */
.shell {
  display: flex; flex-direction: row;
  width: 100vw; height: 100dvh;
  overflow: hidden;            /* 替换原 min-height: 100vh */
  background: var(--color-bg-page);
}
.column {
  flex: 1 1 auto; min-width: 0;
  height: 100dvh; min-height: 0;
  overflow: hidden;            /* 替换原 min-height: 100vh */
  display: flex; flex-direction: column;
}
```

> 注：`Workspace` 自身保持 `max-width` 语义不变；高度由 ScreenLockShell 在内部接管。

### 1.2 Home view root 网格

原型 Home v2.1.html `.workspace`：

```css
grid-template-rows:
  var(--topbar-h)   /* topbar  → PageHeader */
  auto              /* metric  → 4 KPI 卡 */
  minmax(0, 1.6fr)  /* center  → Calendar 单 panel */
  minmax(0, 1fr);   /* bottom  → 3 卡 row */
gap: var(--sp-4);
overflow: hidden;
```

实现：

```tsx
<ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)">
  <PageHeader ... />
  <section className={styles.metricRow}> ...4 metric cards </section>
  <ScrollRegion> <CalendarPanel /> </ScrollRegion>
  <section className={styles.bottomRow}> ...3 bottom cards </section>
</ScreenLockShell>
```

> Calendar panel 内部自有 hour-grid scroll；`<ScrollRegion>` 给到 Calendar 是为了 metric/bottom 高度突变时 calendar 行不破。

### 1.3 Calendar 单 panel（合并 PlanSection + CalendarView）

原型只有 1 个 panel，head 同一行：

```
[ 日历视图 tabs(今日/本周/本月) ] ... [ < · prev | ○ today | > · next | + new ] [ 国考 D-138 chip ]
```

实现合并：删 `PlanSection` 与 `Today/Week/Month CalendarView` 的双层 head，改成单层 `<CalendarPanel>`：

- `<Panel>` head：左 panel-tabs、右 panel-actions（4 按钮）+ countdown chip
- `<Panel>` body：根据 `currentView` 渲染 today / week / month 画布


## 2. Required Interactive Elements

### 2.1 PageHeader（topbar 行）

| 元素 | 位置 | 行为 | 必须？ |
|---|---|---|---|
| 问候 h2 + 日期 sub p | 左 | 静态 | 必须 |
| 命令面板入口 `topbar-cmd` (⌘K) | 中 | 打开 CmdK（已有 KBar/CmdK 组件，本 issue 仅占位） | 必须 |
| 通知 icon-btn | 右 | 占位 | 必须 |
| 设置 icon-btn | 右 | 跳 `/me`（设置 sub-tab） | 必须 |
| 主 CTA `btn-cta` "开始今日练习" | 右 | 跳 `/practice` | 必须 |

### 2.2 Metric row（4 格）

按原型 v2.1：第 1 格 D-188 倒计时 + 进度条；第 2 格"今日核心计划 8/15 + delta"；第 3 格"本周复习进度 62% + delta"；第 4 格"本阶段累计错题 47 + delta(资料分析占 38%)"。

每格信息块：`icon-slot(32×32)` + `data{ v(26px tabular-nums) + label + delta(up/down/warn/flat) }`，第 1 格额外 `progress-track`。

### 2.3 Calendar panel head 4 按钮（必须）

| 按钮 | aria-label | 行为 |
|---|---|---|
| `panel-tabs` | "日历视图" | 今日 / 本周 / 本月 三档切换；写入 `useDashboardPreferenceStore.homeCalendarView` |
| ◀ prev | "上一周/月/日" | 视图依赖：today=−1d / week=−7d / month=−1mo |
| ○ today | "回到今天" | anchor 重置到 `now` |
| ▶ next | "下一周/月/日" | 视图依赖（同 prev 镜像） |
| ＋ new | "新建事件" | 占位（disabled + tooltip "Plan 创建落 SIK-FU-N"） |

countdown chip 与 panel-actions 同行右侧（不在 PageHeader）。

### 2.4 BottomRow #1 「本周备考回顾」（替换 PLACEHOLDER_TASKS）

| 元素 | 位置 | 行为 |
|---|---|---|
| 圆环进度 64×64 | 左 | `useProgressOverview().summary.week.completionRate` 数据；环内文字百分比 |
| `feed-pill` "坚持 N 天" | head 右 | `summary.week.streakDays` |
| 7-dots `week-dots`（一/二/三/四/五/六/日） | 圆环右 | full / half / 空 三态映射本周打卡 |

数据源：`progressQueries.useProgressOverview` 的 `summary.week`（已有 hook）。bottomRow #2 / #3 不在本 issue scope。

## 3. Information Density

每格卡：
- **bottom-card #1 weekly**：1 圆环 + 1 角标 + 7 dots = 共 3 视觉块
- **bottom-card #2/#3**：见 SIK-FU-D（本契约不约束）
- **metric-card**：1 icon + 1 数字 + 1 label + 1 delta = 4 块
- **Calendar panel**：head（tabs + 4 按钮 + countdown chip）+ body（按 view）

4 状态：
- loading → Skeleton（Panel head 骨架 + body 骨架）
- empty → EmptyState（today/week/month 各自文案）
- error → Inline ErrorCard（含 retry）
- ready → 真实事件渲染

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`。本 issue 出现的关键映射：

| 原型 | V5 |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--ink-1` | `--color-text-primary` |
| `--brand-yellow` | `--color-brand-primary` |
| `--brand-yellow-soft` | `--color-brand-soft` |
| `--shadow-1` | `--shadow-l1` |
| `--r-card` (18px) | `--card-radius` (16px) — V5 已下调 |
| `--sp-4` | `--space-4` |
| `--topbar-h` | `--topbar-h` 同名 |
| `--cat-yanyu` 等 5 个 | `--color-cat-*` 5 个 |
| `DM Sans + Inter`（原型外链） | `--font-family-ui`（自托管 DM Sans route） |
| `JetBrains Mono`（原型外链） | `--font-family-mono` |
| `height: 100vh + overflow: hidden` | `<ScreenLockShell>` |

EventBlock 现有 `color-mix(... 14% / 12% / 18% / 6%)` 硬编码百分比 → 改用 V5 `--color-brand-soft` 思路；categorical soft 没有专门 token，需在 `tokens.css` 新增 `--color-cat-yanyu-soft / -shuliang-soft / -panduan-soft / -ziliao-soft / -shenlun-soft` 五个 token，本 issue wave 1 顺手补。

### 4.1 SSOT Conflicts

| 冲突 | 原型 authority | 系统 authority | 当前裁决 |
|---|---|---|---|
| Home 横向画布默认值 | `Home v2.1.html:338-344` `.workspace { flex: 1 }`，1920 下吃满 Rail 余宽 | V5 `workspace=1440 cap` 默认值（后由 SIK-128 判定为冲突根因） | 横向画布 owner 已被 `SIK-128` supersede；本契约继续只 owner Home 的纵向 grid / 控件密度 |
| desktop 验收档位 | 本契约初版只列 `1440 + mobile` | `2026-05-27` 之后 desktop 主战场改为 `1440 + 1920` 双验 | 自本契约起追加 `1920` desktop pair，mobile 不再替代 1920 |

## 5. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| Rail 桌面分组 | Home v2.1：「主入口/辅助」分两组 + 题库/标签 | 5-tab 平铺（首页/练习/复盘/笔记/我的），无辅助分组 | Profile* v1 原型已迭代为 5-tab，与移动端 BottomTabBar 结构对齐；Home v2.1 是早期草案，已被 Profile* 覆盖 | 2026-05-25 |
| Calendar `+ 新建事件` 按钮 | 原型可触发新建 | 本 issue 仅占位（disabled + tooltip） | Plan 创建流程属未来 SIK-FU-N，本 issue 不做 | 2026-05-25 |
| `target-chip` 多目标筛选（国考/省考） | Today Calendar 原型有 | 本 issue 不做 | exam target store 在 Home M-D（未规划），本 issue 不引入 | 2026-05-25 |
| metric 第 1 格内文「已过 56/244 天」精确文案 | 原型字面 | 用 `useDashboardOverview.nearestExamTarget` 真实数据 | 数据来源已在；只换字面，不漂移 | no drift |

`+ 新建事件` 与 `target-chip` 必须在 issue acceptance 显式标 `defer to wave N`。

## 6. Acceptance Hooks

实现 vs 原型对照表（Reviewer 逐行打勾）：

| # | 项 | 原型行号（Home v2.1.html） | 实现位置 | 状态 |
|---|---|---|---|---|
| A1 | AppShell `height: 100dvh + overflow: hidden` | 75-83, 87-90, 339-356 | `apps/web/src/components/layout/AppShell/AppShell.module.css` | ☐ |
| A2 | Workspace 4 行 grid (auto/auto/1.6fr/1fr) | 339-356 | `Home.tsx` 用 `<ScreenLockShell rows="...">` | ☐ |
| A3 | Calendar 单 panel | 1294-1449 | `Home/sections/CalendarPanel.tsx`（合并 PlanSection + Today/Week/Month） | ☐ |
| A4 | panel-actions 4 按钮 | 1294-1313 | `CalendarPanel` 头部 | ☐ |
| A5 | metric row 4 格（含 D-188 进度条） | 1383-1440 | `Home.tsx` `metricRow` | ☐ |
| A6 | bottom-card #1 weekly ring + 7 dots | 1454-1480 | `Home/sections/WeeklyReviewSection.tsx`（新建） | ☐ |
| A7 | 一屏锁死无整页滚 | html/body overflow: hidden | Chrome MCP 截图：滚轮在 ScrollRegion 内生效，外部不滚 | ☐ |
| A8 | `lint-screen-lock` 通过 | n/a | `node apps/web/scripts/lint-screen-lock.mjs` exit 0 | ☐ |

Chrome MCP 双开 diff 截图归档到 `.tmp_review/visual-diff/sik-fu-a/`：
- `prototype-desktop-1440x900.png`（基于 `Home v2.1.html`）
- `implementation-desktop-1440x900.png`
- `prototype-desktop-1920x1080.png`
- `implementation-desktop-1920x1080.png`
- `prototype-mobile-390x844.png`
- `implementation-mobile-390x844.png`

每张图必须可见上述 A1-A6 全部元素；A7/A8 由命令行验证。

## 7. Wave Plan

- Wave 1: AppShell 高度链 + ScreenLockShell 接入 Home + lint-screen-lock 接入 lint:scripts（≤6 文件）
- Wave 2: Calendar 单 panel 合并（删 PlanSection / TodayCalendarView / WeekCalendarView / MonthCalendarView 的双 head；新建 `CalendarPanel.tsx` + 4 按钮 + 翻页 anchor state）
- Wave 3: bottom-card #1 `WeeklyReviewSection.tsx`（圆环 + 7 dots），替换 PLACEHOLDER_TASKS
- Wave 4: tokens.css 补 `--color-cat-*-soft` + EventBlock 改用 token + a11y role 修正

## 8. 参考

- `docs/vault/04-design/Web-Layout.md` §1-3
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- 原型：`.tmp_review/out/Tab1-Home/Home v2.1.html`、Today/Week/Month Calendar v1.html
