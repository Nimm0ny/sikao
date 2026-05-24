# V5 Frontend Style Guide — Spec Delivery Evidence

> Companion to `requirements.md` + `design.md` + `tasks.md`.
> Closed: 2026-05-24. Final HEAD: see Phase 8 commit list below.

This evidence ledger collects the PASS proof for every phase checkpoint
from M0 (docs-only intake) through M11 (this document). Each phase row
points to the git commit, the Multica issue evidence comment, and the
verification chain output (lint / unit / visual / a11y).

## Phase delivery summary

| Phase | Multica issue | Status | HEAD commit | Evidence comment |
|---|---|---|---|---|
| M0 V5 docs-only intake | SIK-72 | done | (initial spec triplet authored 2026-05-19) | inline in spec triplet |
| M0.5 V5 big-bang rebuild | SIK-86 | done | `9f3669692` (V5-M0.5 plan) → big-bang sequence | tracked under SIK-86 |
| M1 Tokens.css 三层 + 多端 | SIK-73 | done | (V5-M1 commit chain ending at SIK-73 close) | tracked under SIK-73 |
| M2 6 Lint gates | SIK-74 | done | `01b99c0e6` (last lint, lint-v4-token-residual) | `.tmp_review/sik-74-evidence.md` |
| M3 Phase 3 35 components | SIK-75 | done | `c0661b30a` (wave 14 — D.3.28-31 + ExamLayout) | `d7dca6fd-87bc-4299-bc23-20683ec28919` |
| M3.5 Phase 4 6 desktop pages | SIK-87 | done | `0386da520` (wave 17 — Review) → `598ae0d05` (review fix) → `aca3557f6` (axe baseline) | `4068af70-bbfa-4d49-9cca-17874543dc7d` + `6a94c185-19fa-4a6c-ae3d-48087e2d67af` (review notes) |
| M4 Phase 5 SVG sprite | SIK-76 | done | `858086967` (wave 24 — nav-* icons) | `57fd5a31-d3b6-48aa-b3c6-b8941b01277f` |
| M9 Phase 7 baseline + visual | SIK-88 | done | `d9b52d468` (task 23.2 playwright) | `0390079a-9a7c-4c7e-8220-70d8614b0d17` |
| M11 Phase 8 docs sync + close | SIK-83 | this document | `85f1731ab` (task 25.1) → `1cf151667` (task 25.2) → THIS COMMIT | (this evidence file) |

Phases not present in the table:
- **Phase 6 V4→V5 surface migration** — ARCHIVED 2026-05-24 by V5-M0.5
  big-bang. There is no V4 surface to migrate; SSOT contains zero V4
  token names, verified by `lint-v4-token-residual` (0 hits across 258
  files at HEAD).


## H8 Validation Gate — final run

Captured at HEAD `85f1731ab` (post-task-25.1, immediately before this
commit lands):

| Check | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck -w @sikao/web` | PASS (0 errors) |
| eslint + 14 .mjs lints | `npm run lint -w @sikao/web` | PASS (0 hard violations; 2 pre-existing warn-only ui-copy items) |
| unit + integration | `npx vitest run` | **61 test files / 257 tests PASS** |
| a11y | `npm run test:a11y -w @sikao/web` | **7/7 PASS** (axe-core wcag2aa across 6 views + RootLayout) |
| visual regression | `npm run test:visual -w @sikao/web` | **36/36 PASS** (6 viewport projects × 6 desktop pages, replay against fresh baseline) |
| icon sprite build | `npm run build:icons -w @sikao/design-system` | PASS (36 symbols emitted) |

Repro:

```sh
npm run typecheck -w @sikao/web
npm run lint -w @sikao/web
npx vitest run
npm run test:a11y -w @sikao/web
npm run test:visual:update -w @sikao/web   # first run, creates baseline
npm run test:visual -w @sikao/web          # replay against baseline
```

## Linked artifacts

- **Spec triplet**: `.kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md`
- **Token SSOT**: `packages/design-system/src/tokens.css`
- **Vault mirror**: `docs/vault/04-design/Design-System.md` (rewritten
  task 25.1, commit `85f1731ab`)
- **Baseline report**: `apps/web/v5-baseline-report.md` (Phase 7 task
  23.1, commit `a5028153e`)
- **Fail-fast ledger**: `docs/engineering/fail-fast-exceptions.md`
  (`mobile-bottom-nav-glassmorphism-fallback`, reconciled task 25.2,
  commit `1cf151667`)
- **35 V5 component skeletons**: `apps/web/src/components/**` +
  `apps/web/src/layouts/{RootLayout,ExamLayout}/`
- **6 V5 desktop pages**: `apps/web/src/views/{Home,Practice,Note,Me,QuestionHub,Review}/`
- **36 V5 SVG icon sources** + sprite build: `packages/design-system/src/icons/*.svg`
  + `packages/design-system/scripts/build-icon-sprite.mjs` + sprite output at `apps/web/public/icons.svg`
- **Playwright config + 6 visual specs**: `apps/web/playwright.config.ts` +
  `apps/web/e2e/visual/*.spec.ts`
- **Axe a11y baseline**: `apps/web/src/views/__tests__/views.a11y.test.tsx`


## Resolved decisions cross-reference

V5 closed with the user-locked decisions from `requirements.md §7`
all materialized:

| Decision | Spec ref | Where it landed |
|---|---|---|
| Q1 / REQ-3.1 — Three-layer token architecture | `design.md §A.1` | `tokens.css` lines 60-460; primitive (§1) + semantic (§2-§3) + component (§4) |
| Q2 / REQ-4.3 — N=4 module density on the home grid | `design.md §D.4.1` | Home metric-row × 4 + bottom row × 3 |
| Q3 / REQ-5.5 — System font stack + tabular-nums for `<Numeric>` | `design.md §C.5` | `tokens.css --font-stack-{ui,mono}` + `Numeric.module.css font-variant-numeric: tabular-nums` |
| Q4 / REQ-8.4 — BottomTabBar glassmorphism + auto-fallback | `design.md §E.1` | `BottomTabBar.module.css` `.nav` rule + ledger entry `mobile-bottom-nav-glassmorphism-fallback` |
| Q5 / REQ-9.5 — V5 only defines exam token hooks; layout / resize / timer / state-machine in dedicated Exam spec | `design.md §D.4.6` | `tokens.css §4.7` 3 hooks + `apps/web/src/layouts/ExamLayout/` skeleton (test enforces no `<AppShell>` / `<Rail>` nesting) |
| Q6 / REQ-12.2 — V4→V5 dual-track period | n/a | ARCHIVED by V5-M0.5 big-bang; lint-v4-token-residual is the regression guard going forward |
| R1/Q3 — Reading density dial 14/15/17/19 not part of type ramp | `design.md §D.3.29` | `QuestionStem.module.css [data-font-size]` selectors |
| R1/Q5 — Exam interaction lives in dedicated spec | `design.md §D.4.6` | (deferred — Exam interaction spec) |
| R2/Q1 — Note detail uses Drawer (not Modal) | `design.md §D.4.3` | Note view `<Drawer side="right" size="lg">`; test asserts no `<Modal>` rendered |
| R2/Q2 — Tabs absorbs SegmentedControl as a 3-variant component | `design.md §D.3.3` | `Tabs.tsx` `variant: 'underline' \| 'pill' \| 'segmented'`; ScopeToggle = thin business alias |
| R2/Q4 — RailMe avatar replaces 5th nav row on desktop | `design.md §D.3.32` + `§D.5.2` | RootLayout: 5 nav items + RailMe avatar slot; mobile BottomTabBar exposes 我的 as 5th tab |
| R2/Q5 — `--max-w-workspace = 1440px` | `design.md §C.4.1` | `tokens.css` line 485; Workspace `data-max-width="workspace"` selector |
| R2/Q6 — Answer-system business components stay in V5 | `design.md §D.3.28-31` | OptionItem / QuestionStem / AnswerSheet / TimerDisplay all skeleton-landed in Phase 3 wave 14 |


## Correctness Properties (CP) — closure status

| Property | Validation channel | Status |
|---|---|---|
| **CP.1 Token Single Source** | `lint-{shadow,zindex,spacing,radius,hardcode}-token` | active, 0 hits |
| **CP.2 Theme Switching Stability** | (deferred property test 1.3 — `*` optional) | manual verification done; no semantic / primitive / component layer drift between `:root` + `[data-theme='dark']` + `[data-theme='night']` |
| **CP.3 Nested Radius Difference** | manual review + `design.md` Card spec | enforced by 5 card-type contracts; no automated regression yet (Phase 7 23.2d optional task) |
| **CP.4 CJK No-Italic** | `lint-italic` | active, 0 hits |
| **CP.5 SVG-Only Icon** | `lint-icon-style` + `lint-no-emoji-as-icon` + `lint-practice-svg-only` | active; 36 sprite sources clean |
| **CP.6 Focus Visibility** | (deferred property test 23.2b — `*` optional) | manual verification + `:focus-visible` outline tokens in every interactive surface |
| **CP.7 Glassmorphism Fallback Closure** | (deferred property test 14.3a — `*` optional) | CSS `@supports not (backdrop-filter)` + `prefers-reduced-transparency: reduce` blocks active in `BottomTabBar.module.css`; ledger entry registered |
| **CP.8 V4 Token Residual Convergence** | `lint-v4-token-residual` | active, 0 hits across 258 files |
| **CP.9 Hover-Touch Affordance** | `lint-touch-target` | active, 0 hits |
| **CP.10 Multi-device Continuity** | `playwright` 6-viewport visual baseline | active, 36/36 PASS |

## Carry-forward debt — cleared (Phase 8 wave 31-35)

The Phase 7 baseline report originally surfaced 5 non-blocking debt
items as carry-forward. Phase 8 cleared all 5 before closing the V5
spec; each is recorded below with its closing commit.

| # | Item | Closing commit | Notes |
|---|---|---|---|
| 1 | Tabs `aria-controls` axe debt | `80a44c33a` | Added `Tabs.noPanel?: boolean` prop; ScopeToggle passes `noPanel`; views.a11y.test.tsx drops the `aria-valid-attr-value` axe suppression — wcag2aa rule re-enabled. |
| 2 | Sprite consumer rewiring | `df97ca68b` | New `<SpriteIcon>` atom helper. RootLayout NAV_ICONS / OptionItem Check+Close / Note Star / QuestionHub StateGlyph all switched from inline SVG paths to `<svg><use href="/icons.svg#<id>" />`. Visual regression baseline regenerated 36/36. |
| 3 | Chip primitive `active?: boolean` | `53985413d` | Chip selectable-mode added (`onSelect` + `active` + `aria-pressed`); Note / QuestionHub / Review FilterBars use the new selectable Chip; ~180 lines of duplicated bespoke `.chip` CSS deleted across 3 view module.css files. |
| 4 | ui-copy SSOT module + 2 violation cleanup | `ba2dbffb5` | `apps/web/src/lib/ui-copy/index.ts` seeded with PAGINATION + COMMAND_PALETTE namespaces; 2 warn-only inline strings (Pagination L185 + CommandPalette L135) migrated; **`lint-ui-copy-ssot` flipped to `error` mode** (env-var + CLI flag escapes preserved). |
| 5 | Rail SPA-routing prop | `17a39185b` | `RailNavItem.onClick?: (event) => void` prop added; RootLayout wires `useNavigate` for plain left-clicks; modifier-clicks (Cmd/Ctrl/Shift/Alt) and middle-click fall through to the native `<a href>` so "open in new tab" still works. |

Final verification at HEAD `df97ca68b`:

- typecheck PASS
- lint PASS — **0 hard violations / 0 warn-only items** (`lint-ui-copy-ssot`
  in error mode reports 0 violations across 60 files)
- vitest **62 test files / 271 tests PASS** (+1 file SpriteIcon /
  +14 cases across the 5 cleanup commits vs. Phase 7 close baseline)
- `npm run test:a11y` 7/7 PASS with the wcag2aa `aria-valid-attr-value`
  rule active
- `npm run test:visual` 36/36 PASS against the post-sprite-rewire
  baseline

## ~~Known carry-forward debt (non-blocking)~~ — cleared 2026-05-24

> **All 5 items below were cleared in Phase 8 waves 31-35; see the
> "Carry-forward debt — cleared" table above for the closing commits.
> Section retained for historical context.**

These items were surfaced in the Phase 7 baseline report's Top-5 fix
priority list. None of them block the V5 spec close; each has a
clear owner-Phase for the next iteration:

1. ~~**Tabs `aria-controls` axe debt**~~ — **CLEARED** (`80a44c33a`).
2. ~~**Sprite consumer rewiring**~~ — **CLEARED** (`df97ca68b`).
3. ~~**Chip primitive `active?: boolean`**~~ — **CLEARED** (`53985413d`).
4. ~~**ui-copy SSOT module + 2 violation cleanup**~~ — **CLEARED** (`ba2dbffb5`).
5. ~~**Rail SPA-routing prop**~~ — **CLEARED** (`17a39185b`).

## Verdict

V5 spec **closed** at this commit. `requirements.md` 12 REQ blocks
are all green; `design.md` 35 component contracts are all skeleton-
landed; `tasks.md` waves 0-30 (Phase 1-8) are done; waves 21-24
(V4→V5 surface migration) are ARCHIVED by V5-M0.5 and require no
follow-up. **All 5 carry-forward debt items from the Phase 7
baseline report have been cleared in Phase 8 waves 31-35** — the
V5 surface ships clean.

Next iteration: business Phases (Home / Practice / Notes / Review /
Profile families) consume the V5 surface directly. There is **no
recommended carry-forward starting point** — every item flagged
during the V5 cycle has been resolved before close.

## Sign-off

- lhr — V5 spec author + final approval
- Mode at close: Master Mode (Runner-only execution per 2026-05-24
  standing directive)
