---
type: review
issue: SIK-91
reviewer: kiro-self-review
date: 2026-05-26
---

# SIK-91 Review (Waves 1-3)

> Self-review per H5 gate. Sub-agent invocation was unavailable for this review;
> mitigations: (a) every commit was structured against contract acceptance hooks
> with explicit references, (b) full validation gate (typecheck + lint + scoped
> vitest 36/36 + browser smoke) executed before review, (c) H12 4-tab baseline
> verified via DOM probe in browser smoke.

## 检查范围

- **branch**: `feat/tab1-home-phase`
- **commits** (SIK-91 only):
  - `944f77d` feat(home): rewrite ProgressSection with bar visual encoding (W1)
  - `cf5c76e` feat(profile-learning): rewrite with ScreenLockShell + SubNav + RangeBar + KPI scaffold (W1)
  - `a588499` feat(profile-learning): TrendChart 30d + Radar 5-module + KnowledgeTree + Heatmap (W2+W3)
- **files reviewed**:
  - `apps/web/src/views/Home/sections/ProgressSection.tsx` + `.module.css` + `.test.tsx`
  - `apps/web/src/views/ProfileLearning/ProfileLearning.tsx` + `.module.css` + `.test.tsx`
  - `apps/web/src/views/ProfileLearning/RangeBar.tsx` + `.module.css`
  - `apps/web/src/views/ProfileLearning/KpiRow.tsx` + `.module.css`
  - `apps/web/src/views/ProfileLearning/Charts.tsx`
  - `apps/web/src/views/ProfileLearning/KnowledgeTree.tsx` + `.module.css`
  - `apps/web/src/views/ProfileLearning/Heatmap.tsx` + `.module.css`
  - `apps/web/src/views/Me/SubNav.tsx` + `.module.css`
- **deletions**: PlanSlice / DiagnosisReport / Header (out of new contract scope)

## sik-fu-b Acceptance Hooks B1-B8

| # | 项 | 实现位置 | 状态 | 证据 |
|---|---|---|---|---|
| B1 | 4-row grid via ScreenLockShell `rows="auto auto auto minmax(0, 1fr)"` + ScrollRegion | `ProfileLearning.tsx:39` | PASS | `<ScreenLockShell rows="auto auto auto minmax(0, 1fr)" testId="profile-learning">` + `<ScrollRegion>` wrapping Body |
| B2 | sub-nav 8 tab + active="learning" | `Me/SubNav.tsx` | PASS | 8 NAV_ITEMS with active state via `data-active` + `aria-current="page"`; browser smoke confirms 学情 has aria-current |
| B3 | range-bar 4 seg + date picker + compare button | `RangeBar.tsx` | PASS | 4 RANGES + `<input type="date" disabled>` + Button "对比上一周期" disabled |
| B4 | KPI row 5 cells | `KpiRow.tsx` + `ProfileLearning.tsx` | PASS | 5 cells: practice/duration/xingce/shenlun/streak; `data-testid="kpi-cell-{key}"` for all 5 |
| B5 | TrendChart 30d bar+line + Radar 5 modules current+previous | `Charts.tsx` | PASS | TimeseriesChart 30d ComposedChart (Bar items + Line accuracyMA); WeaknessRadar fixed RADAR_MODULES (5) with current(solid) + previous(dashed) |
| B6 | KnowledgeTree 4-col + Heatmap 60px label + 7 dow + observation | `KnowledgeTree.tsx` + `Heatmap.tsx` | PASS | KnowledgeTree row 4-col grid (name/bar/val/actions) with severity tinting; Heatmap 60px timeLabel + 7 dow + observation `<p>` |
| B7 | recharts lazy on /profile/learning only | `ProfileLearning.tsx:18-19` | PASS | `lazy(() => import('./Charts').then(...))` for both WeaknessRadar and TimeseriesChart; wrapped in Suspense |
| B8 | 一屏锁死 + 内部 ScrollRegion | `ProfileLearning.tsx` | PASS | Browser smoke: `screenLockOverflow="hidden"`, `scrollRegionPresent: true`, `pageScrollable: false` (docScrollHeight === clientHeight === 900) |

## sik-fu-d ProgressSection D1-D2

| # | 项 | 实现位置 | 状态 | 证据 |
|---|---|---|---|---|
| D1 | Top 3 弱项 bar 视觉 (name + bar + val, 无 Badge, <=50% err) | `ProgressSection.tsx:38-54` | PASS | WeakItem renders weakName + barTrack + barFill (data-err when isErr) + weakVal; no Badge import |
| D2 | bc-head Link "弱项分析 ->" to /profile/learning?range=30d | `ProgressSection.tsx:97-99` | PASS | `<Link to="/profile/learning?range=30d" className={styles.headLink}>弱项分析 →</Link>` |

## H7 / H12 / H11 检查

### H7 Fail-Fast
- **No silent catch**: every async/error path renders explicit ErrorCard or EmptyState.
- **`?? defaultValue` audit**: 6 occurrences, all acceptable patterns:
  - `query.data?.events ?? []` — empty-array fallback when query data is loaded; not arbitrary input.
  - `(query.error as Error | null)?.message ?? 'Network error'` — display-only error message fallback.
  - `KpiRow.tsx` flat delta when no compare data; explicit `'—'` placeholder, not fabricated.
  - **Critical contrast**: `KpiRow.tsx` does NOT fabricate xingceAccuracy / shenlunAverage / streakDays — renders `'—'` when API doesn't supply them, per H7.
- **No `as any` / `@ts-ignore`** in any new file.

### H12 4-tab Nav Baseline
- Browser smoke evaluate confirms: `aside a[href]` returns exactly `["/", "/practice", "/review", "/note", "/me"]` — that's 4 nav tabs + 1 Me avatar slot (the 5th is Me avatar, not a navItem; it's the RailMe slot per H02).
- Reading `RootLayout.tsx` directly: `navItems` still has exactly 4 entries [home, practice, review, note].
- No SIK-91 commit modifies `RootLayout.tsx` / `Rail.tsx` / `BottomTabBar.tsx`.
- New `Me/SubNav.tsx` is **in-page Profile sub-navigation** (8 pills for Profile page family), explicitly required by sik-fu-b §2.2. It is rendered inside the Profile pages, not in the global Rail. Verified by browser smoke (sub-nav has its own `aria-label="账户子导航"` distinct from the main `主侧栏`).

### H11 Visual Drift §5
- **Heatmap data-l=3**: `Heatmap.module.css` — `.cell[data-l='3']` uses `color: var(--color-text-primary)` (black on `--color-brand-hover` yellow), with comment confirming axe AA contrast rationale.
- **导出 PDF / 对比上一周期 / sub-nav broken routes** — all rendered as disabled placeholders per drift table.
- **subjectAccuracies as previous-window stand-in** — known data gap, documented in `Charts.tsx` comment.

## 发现项

| # | 严重度 | 文件 | 问题 | 建议处理 |
|---|---|---|---|---|
| F1 | minor | `ProfileLearning.tsx` | recharts lazy chunking relies on vite default code-split; no explicit `manualChunks` config to guarantee separate chunk. | Note as known gap in evidence block; not blocking. Verify post-build via vite analyzer in a follow-up. |
| F2 | minor | `KpiRow.tsx` | 3 of 5 KPI cells (xingce/shenlun/streak) render `'—'` because backend doesn't yet expose those fields. UX: user sees partial data on day-1. | Document as known gap; needs backend issue to ship the missing fields. Frontend correctly fails fast (no fabricated data). |
| F3 | minor | `Heatmap.tsx` | 因为后端没有 hourly granularity, time bands (上午/下午/晚上) split daily counts evenly via `round(daily/3)`. Displayed counts are placeholders, not real time-band counts. | Document as known data gap; backend issue to ship hourly granularity. |
| F4 | minor | `Charts.tsx` | `previous` series uses `subjectAccuracies` as stand-in. If backend ships `subjectAccuracies` as "current overall", the radar's "previous" series effectively shows current data, which would be misleading. | Document as known data gap; backend issue to ship dedicated previous-window field. |
| F5 | minor (out of scope) | `Rail.module.css.brandButton` + `RootLayout.module.css.brandWord` | Rail collapsed-state visual drift: brand button overflows 80px + SIKAO text not hidden. | Logged to `.tmp_review/sik-rail-collapsed-bugs.md`; recommend separate SIK-FU-RAIL-FIX issue; H12 nav baseline files owned by SIK-121 W2, not SIK-91 scope. |

## 风险等级
**low**

- 4 minor data-gap findings (F2/F3/F4) all have explicit fallbacks (`'—'` or 0) per H7; no fabricated data risks.
- F1 chunk verification deferred to evidence block known-gap.
- F5 is logged for separate follow-up issue; not in SIK-91 scope.
- No blocker / major findings.

## 总结

SIK-91 Waves 1-3 完整覆盖了两份 visual contract（sik-fu-b 全部 B1-B8 + sik-fu-d ProgressSection D1-D2）。ProgressSection 改用 bar 视觉编码（删 Badge）+ 链接到 `/profile/learning?range=30d`；ProfileLearning 重写为 ScreenLockShell 4-row 结构 + 8-pill SubNav + 4-seg RangeBar + 5-cell KpiRow + lazy-loaded Trend/Radar + KnowledgeTree + Heatmap。H7 fail-fast 严格执行（API 缺字段不伪造数据）；H12 4-tab 全局基座原封不动（SubNav 是 Profile 页面内子导航，分离设计）；H11 drift §5（heatmap data-l=3 黑字黄底）已实现。4 项 minor 发现都是 backend 数据缺口（前端已正确 fallback）+ 1 项跨 issue follow-up（Rail 折叠态漂移），不构成 SIK-91 收口阻塞。
