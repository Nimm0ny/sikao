---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-25
issue: SIK-FU-C
multica-issue: SIK-93
parent-multica-issue: SIK-112
parent-issues: SIK-93
prototype:
  - .tmp_review/out/Tab5-Profile/Profile Records v1.html
---

# SIK-FU-C · ProfileRecords 视觉契约（H11）

> 修复 SIK-93 视觉漂移：缺 timeline 视觉 / Badge variant 写死 cat-yanyu / 缺 day-group / 缺 stats / sub-nav 不一致。

## 0. Scope

- **修复对象**：`apps/web/src/views/ProfileRecords/**`
- **不修复**：5-tab Rail（已在 SIK-93 wave 1 落地，结构按当前的 5-tab 平铺保留，不回原型 v2.1 分组）
- **owner**：本契约 + ProfileRecords 视觉骨架收口

## 1. Layout Topology

原型 `.ws.profile-ws { grid-template-rows: var(--topbar-h) auto auto minmax(0, 1fr) }`，4 行：
1. ws-topbar
2. sub-nav
3. filter-bar
4. records-wrap（`flex: column; min-height: 0; overflow: hidden`）— 内部 records-body 局部滚 + records-foot 分页

实现：

```tsx
<ScreenLockShell rows="auto auto auto minmax(0, 1fr)">
  <PageHeader title="学习记录" subtitle="..." actions={<导出 icon-btn>} />
  <SubNav active="records" />
  <FilterBar value={filters} onChange={...} />
  <RecordsWrap>
    <ScrollRegion><RecordsBody groups={dayGroups} /></ScrollRegion>
    <RecordsFoot total={total} onLoadMore={...} />
  </RecordsWrap>
</ScreenLockShell>
```

`RecordsWrap` 内部用 flex-column 把 records-body (1fr) 与 records-foot(44px) 隔开。

## 2. Required Interactive Elements

### 2.1 PageHeader / sub-nav

- 导出 icon-btn（disabled 占位 + tooltip）
- sub-nav 8 个 pill，active=学习记录（与 SIK-FU-B 共用 `Me/SubNav.tsx`）

### 2.2 filter-bar

| 元素 | 行为 |
|---|---|
| seg-pills | 全部活动(is-on) / 练习 / 模考 / 复盘 / 笔记 — 写入 `filters.kind` |
| date picker | 起止日期 — 写入 `filters.from / to`（占位，本 issue wave 1 仅渲染 disabled，wave 3 实现） |
| 文字 sub | "今日 + 昨日 + 前天 · N 项活动"（实际从 query.data 拼） |
| `仅看里程碑` btn | 写入 `filters.milestoneOnly`（占位，wave 3 实现） |

### 2.3 records-body 内容结构（重点）

每个 day-group：
- `day-head`（sticky top: 0）：date + week 文本 + summary 「练习 N 组 · 复盘 N 题 · 学习 Nh Nm」
- 多行 `event` —— **timeline 行结构**（4 列 grid）：
  - `time`（80px）：`HH:MM`
  - `ico`（28×28 圆形）：按 `kind` 染色
    - k-practice → `--color-brand-soft` 底 + `--color-text-primary` icon
    - k-mock → `--color-brand-primary` 底
    - k-review → `--color-state-ok-soft` 底 + `--color-state-ok` icon
    - k-shenlun → `--color-cat-shenlun-soft` 底
    - k-note → `--color-state-info-soft` 底
    - k-error → `--color-state-err-soft` 底
  - `body`：t（标题 + tag 角标）+ s（详情）+ stats（横排 N 个 stat 项；ok/warn 分色）
  - `actions`（hover 浮现）：查看 / 重做 / 笔记 等 icon-btn

### 2.4 records-foot

- 文字 "显示 ... 至 ... · 共 N 项"
- `加载更早记录 ↓` btn（分页：替代 `<Pagination>` 的"上一页/下一页"按钮，因为时间轴是无限滚）

> 注：实现里现有 `<Pagination>` 不删，但 ProfileRecords 改用 `加载更早` 按钮（更贴合 timeline 体验）。`<Pagination>` 仍可被其它 view 复用。

## 3. Information Density

- **day-head**：3 块（date / week / summary right-aligned）
- **event 行**：time + ico + body(t + s + stats[N]) + actions = 信息块 ≥ 5
- **stats 子项**：text + b（数字粗体 tabular-nums），可带 ok/warn class

4 状态：
- loading → records-body 内 Skeleton row × 6
- empty → EmptyState（filter 命中 0）
- error → 顶部 Inline ErrorCard（不破 sub-nav / filter-bar）
- ready → day-group 渲染

## 4. Token Map

主要映射查 `Prototype-Token-Map.md`。本 issue 关键：

| 原型 | V5 |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--paper-2 / -3` | `--color-bg-elevated / -sunken` |
| `--ok / -50` | `--color-state-ok / -soft` |
| `--err / -50` | `--color-state-err / -soft` |
| `--warn / -50` | `--color-state-warn / -soft` |
| `--info / -50` | `--color-state-info / -soft` |
| `rgba(21,128,61,.14)` (k-shenlun ico bg) | `--color-cat-shenlun-soft`（待 SIK-FU-A wave 4 补 token） |
| `--brand-yellow / -soft` | `--color-brand-primary / -soft` |
| `--r-card / -tiny` | `--card-radius / --radius-10` |
| `height: 100vh + overflow: hidden` | `<ScreenLockShell>` |

## 5. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| Rail 桌面分组 | 原型 5-tab + bottom me 卡 | 同 | 原型即如此（与 Home v2.1 草案不一致，已统一到 Profile* 原型） | no drift |
| `加载更早` vs `<Pagination>` | 原型用"加载更早 ↓" | 改用"加载更早 ↓"（替换原 SIK-93 的 Pagination 组件用法） | timeline 体验更贴近 | 2026-05-25 |
| 导出 / 仅看里程碑 | 原型可点 | 占位 disabled | 业务流程未规划 | 2026-05-25 |
| event.actions hover 浮现 | 原型 hover opacity 0→1 | 同；移动端无 hover，actions 始终可见 | 触屏可达性 | no drift |

## 6. Acceptance Hooks

| # | 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|---|
| C1 | 4 行 grid + records-body ScrollRegion | 17, 38-43 | `ProfileRecords.tsx` 用 `<ScreenLockShell>` | ☐ |
| C2 | sub-nav 8 tab + active=学习记录 | 156-165 | 共用 `Me/SubNav.tsx` | ☐ |
| C3 | filter-bar 5 seg + date picker + 仅看里程碑 | 169-180 | `FilterBar.tsx` | ☐ |
| C4 | day-head sticky | 46-50 | `DayGroup.tsx` | ☐ |
| C5 | event 4 列 grid + ico kind 染色 + body + stats + actions | 58-104 | `RecordRow.tsx` | ☐ |
| C6 | records-foot `加载更早` | 327-330 | `RecordsFoot.tsx` | ☐ |
| C7 | Badge variant 按 kind 动态映射（不写死 cat-yanyu） | n/a | `RecordRow.tsx` 严格类型守卫 | ☐ |
| C8 | 一屏锁死 + records-body 局部滚 | 12, 17, 38-43 | Chrome MCP smoke | ☐ |

Chrome MCP 双开 diff 截图归档到 `.tmp_review/visual-diff/sik-fu-c/`。

## 7. Wave Plan

- Wave 1: ScreenLockShell + sub-nav 共用 + filter-bar 骨架（占位 actions）
- Wave 2: DayGroup + RecordRow timeline 视觉（4 列 grid + ico 染色 + stats）
- Wave 3: 加载更早分页 + filter date 实现 + 仅看里程碑 toggle 实现
- Wave 4: 4 状态测试 + a11y vitest-axe + Chrome smoke

## 8. 参考

- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- 原型：`.tmp_review/out/Tab5-Profile/Profile Records v1.html`
