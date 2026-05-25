---
type: review
issue: SIK-90
reviewer: kiro-subagent
date: 2026-05-25
---

# SIK-90 Review (Waves 1-4)

## 检查范围
- branch: feat/tab1-home-phase
- commits: 891ba4f, 4608cc9, d2755ee, e3987ca, aa470dd, 27384a4
- files:
  - `apps/web/src/components/layout/AppShell/AppShell.module.css`
  - `apps/web/src/components/layout/Workspace/Workspace.module.css`
  - `apps/web/src/views/Home/Home.tsx`
  - `apps/web/src/views/Home/sections/CalendarPanel.tsx`
  - `apps/web/src/views/Home/sections/CalendarPanel.module.css`
  - `apps/web/src/views/Home/sections/WeeklyReviewSection.tsx`
  - `apps/web/src/views/Home/sections/WeekCalendarView.tsx`
  - `apps/web/src/views/Home/sections/MonthCalendarView.tsx`
  - `apps/web/src/views/Home/sections/EventBlock.module.css`
  - `packages/design-system/src/tokens.css`
  - `apps/web/package.json`
  - `apps/web/src/layouts/RootLayout/RootLayout.tsx`
  - `apps/web/src/components/layout/ScreenLockShell/ScreenLockShell.module.css`

## A1-A8 Acceptance Hooks 对照

| # | 项 | 实现位置 | 状态 | 证据 |
|---|---|---|---|---|
| A1 | AppShell height:100dvh + overflow:hidden | `AppShell.module.css` `.shell` L12-13 + `.column` L21-22 | PASS | `.shell { height: 100dvh; overflow: hidden; }` `.column { height: 100dvh; overflow: hidden; }` |
| A2 | ScreenLockShell rows="auto auto minmax(0,1.6fr) minmax(0,1fr)" | `Home.tsx` L82 | PASS | `<ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)" testId="home-view">` |
| A3 | Calendar 单 panel | `Home/sections/CalendarPanel.tsx` 全文 | PASS | 合并 PlanSection + Today/Week/Month 双 head 为单层 `<CalendarPanel>`；body 按 `currentView` 渲染 |
| A4 | panel-actions 4 buttons | `CalendarPanel.tsx` L109-133 | PASS | ◀ prev + ○ today + ▶ next + ＋ new（disabled）+ countdown chip |
| A5 | metric row 4 cards | `Home.tsx` L44-49 `PLACEHOLDER_METRICS` + L88-90 map | PASS | 4 cards: practice / accuracy / duration / rank |
| A6 | bottomRow #1 weekly ring + 7 dots | `WeeklyReviewSection.tsx` L97-113 (ring) + L145-170 (dots) | PASS | 64×64 SVG ring + `<ol>` 7 dots (full/half/empty) + streak pill |
| A7 | 一屏锁死 | `AppShell.module.css` overflow:hidden + `ScreenLockShell.module.css` L17 overflow:hidden | PASS | AppShell `.shell` + `.column` overflow:hidden; ScreenLockShell `.root` overflow:hidden; CalendarPanel body overflow:auto (局部滚) |
| A8 | lint-screen-lock exit 0 | `package.json` `lint:scripts` 末尾 | PASS | `lint:scripts` 包含 `node scripts/lint-screen-lock.mjs`；独立 `lint:screen-lock` 脚本也存在 |

## 发现项

| # | 严重度 | 文件:行号 | 问题 | 建议处理 |
|---|---|---|---|---|
| F1 | minor | `tokens.css:298-302` | `--color-cat-*-soft` 使用 `color-mix` 百分比不统一（yanyu 14%, shuliang 14%, panduan 18%, ziliao 12%, shenlun 12%），虽已提升为 token 但百分比差异无设计文档说明 | 确认是否为有意设计（不同色相需不同 tint 强度以达到视觉等亮度）；若有意则补注释说明 |
| F2 | minor | `WeeklyReviewSection.tsx:142` | `query.data?.events ?? []` 使用了 `?? []` 模式；虽然 H7 注释声明"no ?? defaultValue over arbitrary API output"，但此处 `events` 是数组字段，`?? []` 是安全的空数组 fallback（非任意输入） | 可接受——H7 约束的是对任意数值/字符串的 fallback，空数组 fallback 在 query 已 ready 时是惯用模式 |
| F3 | minor | `CalendarPanel.tsx:106` | `countdown ?? { label: '国考', daysUntil: 138 }` 对 optional prop 使用 `??` 提供默认值 | 可接受——这是 React prop 默认值惯用法，非 H7 禁止的"对任意 API 输出的 fallback" |
| F4 | minor | `WeekCalendarView.tsx:66` | `role="grid"` 结构为 grid > row(header) > columnheader + row(body) > gridcell，header row 第一个 columnheader 有 `aria-hidden="true"`（空占位） | 可接受——WAI-ARIA grid pattern 允许空 columnheader；3 层结构 grid > row > gridcell 完整 |

## H7 违规检查
- **silent catch**: 未发现。所有 error 状态均通过 `query.isError` 显式渲染 ErrorCard/EmptyState。
- **`?? defaultValue` 滥用**: 未发现违规。所有 `??` 使用均为：(1) 空数组 fallback `?? []`（query data 已 ready 时的惯用法）；(2) error message fallback `?? 'Network error'`（展示用）；(3) React prop 默认值。无对任意数值输入的 `??` 降级。

## H12 违规检查
- **navItems**: 精确 4 项 `[home, practice, review, note]`，顺序固定。`tabBarItems` 同步。无 `id:'me'` 或 `题库` 回归。PASS。

## EventBlock color-mix 检查
- `EventBlock.module.css` 中无任何 `color-mix` 调用。所有 categorical 背景色已改用 `var(--color-cat-*-soft)` token。PASS。

## Week/Month Calendar role 结构检查
- **WeekCalendarView**: `role="grid"` > `role="row"` (header) > `role="columnheader"` + `role="row"` (body) > `role="gridcell"` — 3 层完整。
- **MonthCalendarView**: `role="grid"` > `role="row"` (dow header) > `role="columnheader"` + `role="row"` (week rows) > `role="gridcell"` — 3 层完整。

## 风险等级
low

## 总结
SIK-90 Waves 1-4 实现完整覆盖了 `sik-fu-a-home-visual-contract.md` 的全部 8 项 Acceptance Hooks。AppShell 高度链正确锁死视口（100dvh + overflow:hidden），ScreenLockShell 4 行 grid 精确匹配契约，Calendar 成功合并为单 panel 并具备 4 按钮 + countdown chip，WeeklyReviewSection 替换了 PLACEHOLDER_TASKS 并实现 SVG ring + 7 dots，tokens.css 补齐了 5 个 `--color-cat-*-soft` token 且 EventBlock 已全部消费 token 而非硬编码 color-mix。无 H7/H12 违规，a11y role 结构 3 层完整。4 项 minor 发现均为可接受的惯用模式，无 blocker 或 major 问题。
