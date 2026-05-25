---
type: evidence-block
status: done
owner: lhr
issue: SIK-121
parent-issue: SIK-112
last-reviewed: 2026-05-25
---

# SIK-121 Evidence Block — Rail v5 折叠/展开 + 4-tab 收敛 + Me 头像入口

## Mode

Runner Mode (implementation) → Reviewer Mode (self-review per wave)

## Issue

SIK-121 (Rail v5) under SIK-112 (Tab1 Home 总线)

## Branch / Commits

Branch: `feat/sik-121-w2`

| Wave | Commit | Summary |
|------|--------|---------|
| W1 carry-over | `00f29a34a` | a11y comment 5→4 rail items (review finding #1) |
| W2 RED | `d77add443` | 7 failing tests H05/H06/H07/H10 + Tooltip unify |
| W2 GREEN (Rail) | `469defc29` | Rail visual alignment H06-H10 + Tooltip unify |
| W2 GREEN (RootLayout) | `4cce5796c` | cmd-k surface H05 click + Ctrl/Meta+K |
| W2 review | `75915e3` | docs/reviews/sik-rail-v5-w2.md |
| W3 | `d32a64c` | BurgerDrawer hook H11 tablet 768-1023 |
| W4 (this) | pending | review + evidence + screenshots |

## Changed Files

- `apps/web/src/components/layout/Rail/Rail.tsx`
- `apps/web/src/components/layout/Rail/Rail.module.css`
- `apps/web/src/components/layout/Rail/Rail.test.tsx`
- `apps/web/src/layouts/RootLayout/RootLayout.tsx`
- `apps/web/src/layouts/RootLayout/RootLayout.module.css`
- `apps/web/src/layouts/RootLayout/RootLayout.test.tsx`
- `apps/web/src/lib/ui-copy/index.ts`
- `apps/web/src/views/__tests__/views.a11y.test.tsx`
- `apps/web/src/components/layout/AppShell/AppShell.tsx`
- `apps/web/src/components/layout/BurgerDrawer/BurgerDrawer.tsx`
- `apps/web/src/components/layout/BurgerDrawer/BurgerDrawer.module.css`
- `apps/web/src/components/layout/BurgerDrawer/BurgerDrawer.test.tsx`
- `apps/web/src/components/layout/BurgerDrawer/index.ts`
- `apps/web/src/components/layout/index.ts`
- `packages/shared-utils/src/hooks/useMediaQuery.ts`
- `packages/shared-utils/src/index.ts`

## Requirement Source

`docs/plan/sik-rail-v5-visual-contract.md` (H11 visual contract)

## Implementation Summary

4-wave delivery of Rail v5 visual alignment:
- W1: nav 5→4 tab collapse + Me entry exclusively via RailMe avatar
- W2: cmd-k surface (H05) + toggle sprite (H06) + brand trailing (H07) +
  active indicator bar (H08) + sunken bg (H09) + section heading (H10) +
  Tooltip mode unify (brand/nav/me all [data-tip]::after)
- W3: 768-1023 tablet BurgerDrawer placeholder (H11)
- W4: validation + screenshots + evidence


## Tests / Lint / Typecheck / Build

| Check | Result | Notes |
|-------|--------|-------|
| typecheck | ✅ PASS | `npx tsc -b --noEmit` exit 0 |
| eslint | ✅ PASS | 0 errors, 1 pre-existing warning (mockServiceWorker.js) |
| vitest scoped (layout) | ✅ 57/57 PASS | Rail + RootLayout + BurgerDrawer + all layout tests |
| vitest full | ⚠️ 383/384 | 1 pre-existing failure: ProfileLearning loading (SIK-91) |
| lint-screen-lock | ⚠️ pre-existing | Note/Me views (SIK-90/91/93 scope) |

## Browser Smoke

✅ PASS — Chrome MCP verified at 1280/1440/1920:
- Rail expanded: SIKAO brand + 折叠侧栏 button + 命令搜索 + 导航 heading + 4 nav links + Me avatar + meName + meSub
- Rail collapsed: icons only + tooltips on hover
- Ctrl+K opens CommandPalette dialog
- Toggle button collapses/expands correctly
- localStorage persists state across reloads

## Visual Contract

Contract file: `docs/plan/sik-rail-v5-visual-contract.md`

### Acceptance Hooks 对照表

| # | 项 | 状态 | Wave |
|---|---|---|---|
| H01 | nav = 4 items (no 题库 no 我的) | ✅ PASS | W1 |
| H02 | Me entry unique (aria-label="我的" = 1 node) | ✅ PASS | W1 |
| H03 | Collapsed RailMe [data-tip]::after Tooltip | ✅ PASS | W1 |
| H04 | Expanded RailMe = Avatar + meName + meSub | ✅ PASS | W1 |
| H05 | Ctrl/Cmd+K + click opens CommandPalette | ✅ PASS | W2 |
| H06 | Toggle uses sprite rail-toggle | ✅ PASS | W2 |
| H07 | Toggle in brand row trailing; collapsed hidden | ✅ PASS | W2 |
| H08 | Active nav-btn ::before 3×24px indicator bar | ✅ PASS | W2 |
| H09 | Active bg = --color-bg-sunken (not brand-soft) | ✅ PASS | W2 |
| H10 | Section heading "导航" expanded visible | ✅ PASS | W2 |
| H11 | 768-1023 BurgerDrawer placeholder (no Rail) | ✅ PASS | W3 |

PASS: 11/11

### Chrome MCP 双开 diff 截图归档

Path: `.tmp_review/visual-diff/sik-rail-v5/`

12 screenshots captured:
- prototype-1280-expanded.png / prototype-1280-collapsed.png
- prototype-1440-expanded.png / prototype-1440-collapsed.png
- prototype-1920-expanded.png / prototype-1920-collapsed.png
- impl-1280-expanded.png / impl-1280-collapsed.png
- impl-1440-expanded.png / impl-1440-collapsed.png
- impl-1920-expanded.png / impl-1920-collapsed.png

## Subagent Review

Independent subagent review: not available (Kiro session, subagent
invocation not supported for independent review). Self-review per wave:

- `docs/reviews/sik-rail-v5-w1.md` — conditional-pass (on feat/sik-121-finalize)
- `docs/reviews/sik-rail-v5-w2.md` — pass
- `docs/reviews/sik-rail-v5-w3.md` — pass

## Known Gaps

1. `vitest-axe` not installed — using `axe-core` direct invocation instead.
   Contract A02 wording should be updated to reflect this.
2. ProfileLearning loading test failure — pre-existing (SIK-91 scope).
3. lint-screen-lock failures — pre-existing (Note/Me views, SIK-90/91/93).
4. Tooltip hover delay `0.4s` is a literal value, not a token — matches
   prototype exactly, classified as no drift.

## Rollback Notes

All changes are on `feat/sik-121-w2` branch. If rollback needed:
- `git revert` the W2/W3 commits (atomic, each ≤ 400 lines)
- W1 is already on main; reverting W1 requires reverting `bbcfdf4f8`

## Next Owner

- W3 BurgerDrawer content (nav list, Me entry) → Mobile/Tablet Shell issue
- SIK-93 nav portion → done by SIK-121 (4-tab collapse)
- Contract A02 vitest-axe wording → W4 or future cleanup issue
