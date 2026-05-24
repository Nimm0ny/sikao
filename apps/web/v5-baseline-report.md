# V5 Baseline Report

**Date**: 2026-05-24
**Commit**: `b6bb0adde84f9f0dc0fe127ce93c297b4e6cbe36`
**Phase**: V5 Phase 7 task 23.1 (post-V5-M0.5 big-bang adjustment)

## Adjustment notes (2026-05-24 V5-M0.5 rebuild)

The original `T.2` template ran the V5 lint suite against the V4
prototype HTML in `.tmp_review/out/*.html` to expose the "what we are
migrating away from" baseline. After the V5-M0.5 big-bang rebuild that
section is no longer meaningful — the V4 surface in `apps/web/src/**`
was deleted in commit ② of the big-bang sequence, so there is no
"V4 implementation" to migrate at all.

This baseline therefore scans the **V5 implementation surface only**:

- `apps/web/src/views/**` (6 desktop pages from Phase 4 SIK-87)
- `apps/web/src/components/**` (35 component skeletons from Phase 3 SIK-75)
- `apps/web/src/layouts/**` (RootLayout + ExamLayout from Phase 3-4)
- `apps/web/src/router/**`, `apps/web/src/main.tsx`, `apps/web/src/index.css`
- `packages/design-system/src/**` (tokens.css + 36 icon source SVGs from
  Phase 5 SIK-76)

The "迁移阻塞" section from `T.2` is omitted — there is no V4 surface
to block migration of.


## Scan Scope

| Lint script | Source root | File count | Extensions |
|---|---|---|---|
| `lint-shadow-token` | `apps/web/src/**` | 256 | `.tsx .ts .css .scss` |
| `lint-zindex-token` | `apps/web/src/**` | 256 | `.tsx .ts .css .scss` |
| `lint-spacing-token` | `apps/web/src/**` | 256 | `.tsx .ts .css .scss` |
| `lint-radius-token` | `apps/web/src/**` | 198 | `.tsx .ts` |
| `lint-touch-target` | `apps/web/src/**` | 256 | `.tsx .ts .css .scss` |
| `lint-icon-style` | `packages/design-system/src/icons/**` + `apps/web/src/**` | 36 svg | `.svg` |
| `lint-icon-button` | `apps/web/src/**` | 65 | `.tsx` |
| `lint-no-emoji-as-icon` | `apps/web/src/{views,components}/**` | 60 | `.tsx` |
| `lint-practice-svg-only` | `apps/web/src/**` (practice / essay paths) | 0 | `.tsx` (n/a — surface not yet wired) |
| `lint-italic` | `apps/web/src/**` | 198 | `.tsx .ts` |
| `lint-cn-simplified` | `apps/web/src/**` | 138 | `.tsx .ts` |
| `lint-hardcode` | `apps/web/src/**` | 138 | `.tsx .ts` |
| `lint-v4-token-residual` | `apps/web/**` + `packages/design-system/**` | 258 | `.tsx .ts .css .scss` |
| `lint-ui-copy-ssot` | `apps/web/src/{views,components}/**` | 60 | `.tsx` |

## Violation Summary

| Lint | Violations | Status |
|---|---|---|
| `lint-shadow-token` | **0** | clean |
| `lint-zindex-token` | **0** | clean |
| `lint-spacing-token` | **0** | clean |
| `lint-radius-token` | **0** | clean |
| `lint-touch-target` | **0** | clean |
| `lint-icon-style` | **0** | clean (36 svg sources contracted) |
| `lint-icon-button` | **0** | clean |
| `lint-no-emoji-as-icon` | **0** | clean (post-Phase 4 fix #5; Note Star is now SVG) |
| `lint-practice-svg-only` | **0** | clean (no Practice answering path renders yet) |
| `lint-italic` | **0** | clean |
| `lint-cn-simplified` | **0** | clean |
| `lint-hardcode` | **0** | clean |
| `lint-v4-token-residual` | **0** | clean (V5-M0.5 big-bang preserved 0 V4 names) |
| `lint-ui-copy-ssot` | **2 (warn-only)** | warn |

**Hard-fail lints**: 0 violations across **all** 13 hard lints.
**Warn-only**: `lint-ui-copy-ssot` reports 2 inline-CJK strings; details
in the next section.


## Warn-only details (lint-ui-copy-ssot)

| File | Line | Snippet | Note |
|---|---|---|---|
| `apps/web/src/components/nav/Pagination/Pagination.tsx` | 185 | `跳转至指定页` | inline CJK >4 chars without `@/lib/ui-copy` import |
| `apps/web/src/components/overlay/CommandPalette/CommandPalette.tsx` | 135 | `无匹配结果` | inline CJK >4 chars without `@/lib/ui-copy` import |

These two strings live in V5-M3 component skeletons (Phase 3) and
predate the ui-copy SSOT mode being toggled. The lint is intentionally
warn-only at this stage; the SSOT module (`@/lib/ui-copy`) has not been
authored yet (planned for Phase 8 / business Phase pickup).

All Phase 4 view files (`apps/web/src/views/**`) and the RootLayout
opt out via the documented `// lint-allow-ui-copy` file-level escape
because their copy is design-spec text scaffolding, not user-editable
strings.

## Top 5 fix priorities

The hard-fail lints are all clean, so the top priorities are
non-blocking debt items surfaced during Phase 4 review and Phase 5
rollout, ranked by impact-vs-cost:

1. **Tabs `aria-controls` axe debt** — Tabs (D.3.3) emits
   `aria-controls="tabpanel-<key>"` regardless of whether the caller
   renders a tabpanel; ScopeToggle is the canonical caller that does
   not render one. Fix at the Tabs component layer (add
   `noPanel?: boolean` prop). Tracked in Phase 4 review notes (axe
   suppression `aria-valid-attr-value` is meant to come off after this
   fix). Effort: ~30 minutes.
2. **Sprite consumer rewiring** — `apps/web/src/layouts/RootLayout/RootLayout.tsx`
   (NAV_ICONS), `apps/web/src/components/business/OptionItem/OptionItem.tsx`
   (Check / CloseGlyph), `apps/web/src/views/Note/Note.tsx` (StarIcon),
   `apps/web/src/views/QuestionHub/QuestionHub.tsx` (StateGlyph),
   `apps/web/src/views/Review/Review.tsx` all still use inline SVG
   paths instead of `<svg><use href="/icons.svg#<name>" /></svg>`.
   Switching enables sprite-level theming + reduces template churn
   when a glyph re-design lands. Effort: ~1 hour, naturally absorbed
   by the next visual pass.
3. **Chip primitive `active?: boolean`** — Note / QuestionHub / Review
   each ship a bespoke 60-line `.chip` rule due to the V5-M3 Chip
   atom missing a toggle / active state prop. Collapsing the three
   into a Chip prop change removes ~180 lines of duplicated CSS.
   Effort: ~45 minutes.
4. **ui-copy SSOT module + 2 violation cleanup** — author
   `@/lib/ui-copy` namespace and migrate the two warn-only strings
   above; flip lint-ui-copy-ssot to error mode. Tracked under Phase 8
   doc-sync sprint per V5-M0.5 milestone redistribution. Effort: ~2
   hours including ui-copy organization.
5. **Rail SPA-routing prop** — Rail's `RailNavItem.href` is rendered
   as `<a href>` so each tab click triggers a full page reload. Fix:
   add `as?: ComponentType` or `onClick?` to RailNavItem so callers
   can inject `<Link>` from `react-router-dom`. Effort: ~30 minutes
   plus RootLayout swap.

None of these block Phase 7 task 23.2 visual regression or Phase 8
documentation sync.


## Test baseline (cross-reference)

- `npm run typecheck -w @sikao/web` → PASS (0 errors)
- `npm run lint -w @sikao/web` → PASS (eslint clean + 14 .mjs lints
  green; 2 warn-only items above)
- `npx vitest run` → 61 test files / 257 tests pass
  - 35 component skeleton tests (Phase 3 / SIK-75)
  - 7 page-view tests (Phase 4 / SIK-87 — Home / Practice / Note / Me /
    QuestionHub / Review + RootLayout)
  - 7 axe a11y view-level checks (Phase 4 task 18 / commit `aca3557f6`)
  - 11 form / nav / overlay test groups
- `npm run test:a11y -w @sikao/web` → 7/7 PASS
- `npm run build:icons -w @sikao/design-system` → 36 symbols emitted

## Reproduction

To reproduce this report after the commit referenced above:

```sh
npm run lint -w @sikao/web 2>&1 | tee /tmp/baseline-lint.txt
npm run typecheck -w @sikao/web
npx vitest run
```

Then count violations from each lint script's `clean` / `violations`
banner output and align to the table above.

## Verdict

**Hard-fail lint surface: 100% clean across the V5 implementation.**
This baseline is the entry point for Phase 7 task 23.2 (playwright
visual regression) and Phase 8 (documentation sync + V5 spec close).
The two warn-only `ui-copy-ssot` items + the 5 ranked debt items above
are tracked but do not block Phase progression.
