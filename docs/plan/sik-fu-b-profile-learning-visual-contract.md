---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-25
issue: SIK-FU-B
multica-issue: SIK-91
parent-multica-issue: SIK-112
parent-issues: SIK-91
prototype:
  - .tmp_review/out/Tab5-Profile/Profile Learning v1.html
---

# SIK-FU-B · ProfileLearning 视觉契约（H11）

> 修复 SIK-91 视觉漂移：缺 KPI row 5 格 / 缺知识树 / 缺热力图 / 整页滚未锁死。

## 0. Scope

- **修复对象**：`apps/web/src/views/ProfileLearning/**`
- **不修复**：`Home/sections/ProgressSection`（属 SIK-FU-D）
- **owner**：本契约 + ProfileLearning 视觉骨架收口

## 1. Layout Topology

原型 `.ws.profile-ws { grid-template-rows: var(--topbar-h) auto auto minmax(0, 1fr) }`，4 行：
1. ws-topbar（h2 + crumbs + actions）
2. sub-nav（8 tab pills）
3. range-bar（时间范围 seg + date picker）
4. learning-grid（minmax(0, 1fr) 局部滚）

learning-grid 内部 3 行：
- KPI row（5 格）
- 趋势 + 雷达（2 列：1.5fr / 1fr）
- 知识树 + 热力图（2 列：1.4fr / 1fr）

实现：

```tsx
<ScreenLockShell rows="auto auto auto minmax(0, 1fr)">
  <PageHeader title="详细学情" subtitle="..." actions={...} />
  <SubNav active="learning" />
  <RangeBar value={range} onChange={...} />
  <ScrollRegion>
    <section className={styles.learningGrid}>
      <KpiRow ... />
      <Row2Col left={<TrendChart/>} right={<RadarChart/>} ratio="1.5:1" />
      <Row2Col left={<KnowledgeTree/>} right={<Heatmap/>} ratio="1.4:1" />
    </section>
  </ScrollRegion>
</ScreenLockShell>
```

## 2. Required Interactive Elements

### 2.1 ws-topbar

| 元素 | 行为 |
|---|---|
| 导出 PDF icon-btn | 占位（disabled + tooltip "导出落 SIK-FU-N"） |
| 刷新 icon-btn | 调用 `useProgressOverview().refetch()` |

### 2.2 sub-nav（Profile 页面共享）

8 个 tab pill：概览 / 个人信息 / 考试目标 / **学情(is-on)** / 学习记录 / 偏好 / 安全 / 设置。每个跳到对应路由：

- 概览 → `/me`
- 个人信息 → `/me/info`
- 考试目标 → `/me/goals`
- 学情 → `/profile/learning`（active）
- 学习记录 → `/profile/records`
- 偏好 → `/me/preferences`
- 安全 → `/me/security`
- 设置 → `/me/settings`

> sub-nav 抽到 `apps/web/src/views/Me/SubNav.tsx`，本 issue 与 SIK-FU-C 共用（注：路由若不存在，icon-btn 走 disabled，但仍占位渲染）。

### 2.3 range-bar

- seg-pills：本周 / 最近 30 天(is-on) / 最近 90 天 / 全部
- date picker：起止日期（占位，本 issue wave 1 仅渲染 disabled）
- 文字 sub："数据更新于 5 分钟前 · 含今日实时数据"
- 右侧 `btn-secondary btn-sm` "对比上一周期"（占位 disabled）

### 2.4 KPI row 5 格

| 格 | label | value | unit | delta |
|---|---|---|---|---|
| 1 | 练习题数 | `summary.window.itemsAnswered` | 题 | up/down vs 上窗口 |
| 2 | 学习时长 | `summary.window.durationHours` | h | up/down |
| 3 | 行测正确率 | `summary.window.xingceAccuracy` | % | up/down (pp) |
| 4 | 申论均分 | `summary.window.shenlunAverage` | /50 | up/down (分) |
| 5 | 连续打卡 | `summary.window.streakDays` | 天 | flat (历史最长) |

每格视觉块：label + v(28px tabular-nums) + small(unit) + delta(up/down/flat ▲▼→ + 数值)。

### 2.5 趋势 + 雷达 + 知识树 + 热力图

- **TrendChart**：30 天柱(每日题数) + 7d MA 线(正确率)；recharts lazy import
- **RadarChart**：5 模块（言语/数量/判断/资料/申论），实线本期 + 虚线上期；recharts lazy import
- **KnowledgeTree**：4 列 grid（name | progress bar | 数值 | actions），按 severity（is-weak err / is-mid warn / 默认 ok）染色
- **Heatmap**：60px 时段标签列 + 7 列星期；data-l 0/1/2/3 四档底色；底部 `info` 文字提示

## 3. Information Density

- **KPI 卡**：4 视觉块（label + v + unit + delta）
- **TrendChart 卡**：head(h3 + sub) + svg + legend
- **RadarChart 卡**：head + svg + legend(5 模块色块)
- **KnowledgeTree 卡**：head + N 行 tree-row（4 列）
- **Heatmap 卡**：head + grid(60px + 7×n) + observation 提示 box

4 状态：
- loading → KPI Skeleton ×5 + 2-col Skeleton ×2
- empty → 单一 EmptyState（窗口内无数据）
- error → 顶部 Inline ErrorCard（不破坏 sub-nav / range-bar）
- ready → 全骨架渲染

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`。本 issue 关键映射：

| 原型 | V5 |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--paper-3` | `--color-bg-sunken` |
| `--brand-yellow / -hover / -soft` | `--color-brand-primary / -hover / -soft` |
| `--ok / -50` | `--color-state-ok / -soft` |
| `--err / -50` | `--color-state-err / -soft` |
| `--warn / -50` | `--color-state-warn / -soft` |
| `--info / -50` | `--color-state-info / -soft` |
| `--r-card` (18px) | `--card-radius` (16px) |
| heatmap `data-l` 渐进色 | 用 `--color-brand-soft / -primary / -hover` 三档 |

> heatmap `data-l='3'` 原型用 `var(--brand-yellow-hover)` 配 `color: #fff`，但 V5 brand 是黄色 → 黄底白字对比度不足。本 issue 改用 `--color-text-primary`（黑字）on `--color-brand-hover`，写进 drift §5。

## 5. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| heatmap data-l=3 文字色 | `#fff` 白字 | `var(--color-text-primary)` 黑字 | 白字+黄底对比度不足，不过 axe (WCAG AA) | 2026-05-25 |
| 导出 PDF / 对比上一周期 | 原型可点 | 本 issue 占位 disabled | 业务流程未规划，本 issue 不引入 | 2026-05-25 |
| sub-nav 链接 | 原型可点 | 部分子路由（info/goals/preferences/security/settings）若不存在则 link disabled | sub-nav 路由收口属 Me phase | 2026-05-25 |
| recharts 数据形状 | 原型 SVG 内联手写 | 接 `useProgressTimeseries` / `useProgressWeakness` 真实 hook | 数据来源已锁，不漂移 | no drift |

## 6. Acceptance Hooks

| # | 项 | 原型行号（Profile Learning v1.html） | 实现位置 | 状态 |
|---|---|---|---|---|
| B1 | 4 行 grid + learning-grid 内部 ScrollRegion | 17, 39 | `ProfileLearning.tsx` 用 `<ScreenLockShell>` | ☐ |
| B2 | sub-nav 8 tab + active=学情 | 14-16 + body | `Me/SubNav.tsx` | ☐ |
| B3 | range-bar 4 seg + date picker + 对比按钮 | 24-37 | `RangeBar.tsx` | ☐ |
| B4 | KPI row 5 格 | 41-50 | `KpiRow.tsx` | ☐ |
| B5 | 趋势 + 雷达 row-2col 1.5:1 | 56-58 | `Charts.tsx` lazy | ☐ |
| B6 | 知识树 + 热力图 row-2col 1.4:1 | 91 + 115 | `KnowledgeTree.tsx` + `Heatmap.tsx` | ☐ |
| B7 | recharts 仅 /profile/learning 路由触发下载 | bundle chunk 检查 | vite analyzer 报告路径 | ☐ |
| B8 | 一屏锁死 + 内部局部滚 | html/body overflow:hidden | Chrome MCP smoke | ☐ |

Chrome MCP 双开 diff 截图归档到 `.tmp_review/visual-diff/sik-fu-b/`，含 desktop + mobile 两套。

## 7. Wave Plan

- Wave 1: ScreenLockShell 接入 + sub-nav 抽出（共用）+ range-bar
- Wave 2: KPI row + TrendChart + RadarChart（recharts lazy）
- Wave 3: KnowledgeTree + Heatmap

## 8. 参考

- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- 原型：`.tmp_review/out/Tab5-Profile/Profile Learning v1.html`
