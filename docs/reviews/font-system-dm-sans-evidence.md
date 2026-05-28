---
type: evidence-block
status: done
owner: codex
last-reviewed: 2026-05-28
scope: font-system-dm-sans-step-1-closeout
---

# Font System · DM Sans Evidence Block

## Mode

Master Mode → Verifier Mode → Reviewer Mode

## Issue

Local closeout for Font System Step 1 (`system layer`) and Home typography
re-audit. No Notion issue URL was attached to this session.

## Requirement Source

- `docs/plan/font-system-dm-sans-rollout-2026-05-28.md`
- `.kiro/specs/frontend-style-guide-v5/{requirements,design,evidence}.md`
- `docs/vault/04-design/Design-System.md`
- `docs/plan/sik-fu-a-home-visual-contract.md`

## Changed Files

- `packages/design-system/src/fonts/**`
- `packages/design-system/src/tokens.css`
- `apps/web/src/index.css`
- `apps/web/src/components/overlay/CommandPalette/CommandPalette.module.css`
- `apps/web/src/components/overlay/Tooltip/Tooltip.module.css`
- `apps/web/src/layouts/RootLayout/RootLayout.module.css`
- `apps/web/src/views/Home/sections/HomeTopbar.module.css`
- `apps/web/scripts/lint-font-family-token.mjs`
- `apps/web/scripts/lint-external-font-hosts.mjs`
- `apps/web/vite.config.ts`
- `.kiro/specs/frontend-style-guide-v5/{requirements,design,evidence}.md`
- `docs/vault/04-design/Design-System.md`
- `docs/vault/04-design/Frontend Style Guide.html`
- `docs/vault/05-migration/Phase/Style-Guide-V5/{00-Decisions,02-Token-System}.md`
- `docs/plan/font-system-dm-sans-rollout-2026-05-28.md`

## Implementation Summary

- Self-hosted `DM Sans`, `Inter`, and `JetBrains Mono` assets land in the
  design-system and emit through the dev/build route
  `__design-system-fonts`.
- Global UI font truth is centralized in `--font-family-ui`,
  `--font-family-ui-secondary`, and `--font-family-mono`.
- `body` consumes `--font-family-ui`; `kbd` / mono surfaces consume
  `--font-family-mono`.
- Font governance gates now align with the documented `apps/*/src/**`
  scope instead of only `apps/web/src/**`.
- `docs/vault/04-design/Frontend Style Guide.html` is reduced to an archive
  landing page and no longer carries live typography truth.

## Tests / Lint / Typecheck / Build

| Check | Result | Notes |
|---|---|---|
| typecheck | PASS | `npm run typecheck` exit 0 |
| lint | PASS | `npm run lint` exit 0; warnings only, no errors |
| test | PASS | `npm run test` exit 0 |
| build | PASS | `npm run build` exit 0 |
| font-family gate | PASS | `lint-font-family-token.mjs` now scans `apps/*/src/**` |
| external-font gate | PASS | `lint-external-font-hosts.mjs` scans app runtime/build surfaces + design-system |

## Browser Smoke

Runtime verified on the live Home page via the in-app browser:

- `body` computed `font-family`:
  `"DM Sans", Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- `kbd` computed `font-family`:
  `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`
- `document.fonts.check('16px "DM Sans"') = true`
- `document.fonts.check('12px "JetBrains Mono"') = true`
- No runtime `fonts.googleapis.com` / `fonts.gstatic.com` references detected
- `CommandPalette` input computed `font-family` also resolves to the DM Sans
  chain

## Font Asset Route

Verified all self-hosted assets over the live runtime route:

- `/__design-system-fonts/dm-sans-latin-variable.woff2` → `200`
- `/__design-system-fonts/dm-sans-latin-ext-variable.woff2` → `200`
- `/__design-system-fonts/inter-latin-variable.woff2` → `200`
- `/__design-system-fonts/inter-latin-ext-variable.woff2` → `200`
- `/__design-system-fonts/jetbrains-mono-latin.woff2` → `200`

## Visual Contract

Primary contract:
- `docs/plan/sik-fu-a-home-visual-contract.md`

Typography supplement archive:
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-today-1440.png`
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-today-1920.png`
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-week-1440.png`
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-week-1920.png`
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-month-1440.png`
- `.tmp_review/visual-diff/font-system-dm-sans-home/home-month-1920.png`

### Acceptance Hooks Cross-Check

| Hook | Verdict | Evidence |
|---|---|---|
| A1 AppShell `height: 100dvh + overflow: hidden` | PASS | `apps/web/src/components/layout/AppShell/AppShell.module.css` + live Home browser smoke |
| A2 Home 4-row grid via `ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)"` | PASS | `apps/web/src/views/Home/Home.tsx` |
| A3 Single Calendar panel | PASS | `apps/web/src/views/Home/sections/CalendarPanel.tsx` + `home-{today,week,month}-{1440,1920}.png` |
| A4 Panel actions 4 buttons | PASS | `apps/web/src/views/Home/sections/CalendarPanel.tsx` + browser DOM snapshot |
| A5 Metric row 4 cards | PASS | `apps/web/src/views/Home/sections/MetricRow.tsx` + `home-{today,week,month}-{1440,1920}.png` |
| A6 Weekly review ring + 7 dots | PASS | `apps/web/src/views/Home/sections/WeeklyReviewSection.tsx` + `home-{today,week,month}-{1440,1920}.png` |
| A7 One-screen lock, no full-page outer scroll | PASS | live Home browser smoke at `1440 / 1920` |
| A8 `lint-screen-lock` | PASS | `npm run lint` → `lint-screen-lock: 0 violations` |

## Subagent Review

- `docs/reviews/font-system-dm-sans-w1.md`

Review disposition after fixes:
- no runtime correctness finding
- authority drift fixed by archive stub
- gate scope aligned to documented `apps/*/src/**` claim

## Known Gaps

- Overall rollout plan remains active for Step 3 page-by-page adoption.
- This evidence block closes Step 1 and the current Home typography re-audit;
  it does not claim Practice / Review / Note / Me / Profile / QuestionHub font
  rollout is complete.

## Next Owner

- Future page adoption wave owner: follow-up rollout work under
  `docs/plan/font-system-dm-sans-rollout-2026-05-28.md`
