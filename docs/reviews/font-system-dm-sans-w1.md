---
type: review
status: active
owner: codex
last-reviewed: 2026-05-28
reviewer: independent-subagent
scope: font-system-dm-sans-rollout
---

# Font System · DM Sans Review W1

## Scope

- `packages/design-system/src/tokens.css`
- `packages/design-system/src/fonts/**`
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

## Findings

### 1. Medium · active authority still conflicts with the DM Sans route

- Evidence:
  - `docs/vault/04-design/Frontend Style Guide.html:5-10`
  - `docs/vault/04-design/Frontend Style Guide.html:629`
  - `docs/vault/04-design/Frontend Style Guide.html:775-787`
  - `docs/vault/04-design/Frontend Style Guide.html:1633-1636`
  - `docs/vault/04-design/Design-System.md:310`
- Issue:
  - Historical HTML now carries a "historical reference only" note, but the file body still contains Google Fonts links, `Source Serif 4 + Inter` truth, italic semantics, and old type guidance.
  - `Design-System.md` still lists that file in related references.
  - This conflicts with the formal DM Sans route defined in:
    - `.kiro/specs/frontend-style-guide-v5/requirements.md:102`
    - `docs/vault/05-migration/Phase/Style-Guide-V5/00-Decisions.md:51`
    - `docs/vault/05-migration/Phase/Style-Guide-V5/02-Token-System.md:128-140`
    - `docs/plan/font-system-dm-sans-rollout-2026-05-28.md:39-41`
- Impact:
  - "active authority truth unified" is not fully closed.
  - Runners/reviewers can still read the old HTML as live typography truth.

### 2. Medium · gate coverage is narrower than the documented governance claim

- Evidence:
  - `.kiro/specs/frontend-style-guide-v5/design.md:161`
  - `docs/plan/font-system-dm-sans-rollout-2026-05-28.md:25`
  - `apps/web/scripts/lint-font-family-token.mjs:7-8`
  - `apps/web/scripts/lint-external-font-hosts.mjs:9-14`
- Issue:
  - Documentation says `apps/**/src/**` must not hardcode `font-family`.
  - Actual lint only scans `apps/web/src`.
  - External font host lint is also web-centric.
- Impact:
  - The current implementation is sufficient for `apps/web`.
  - It is not sufficient to claim that the system-layer gate is fully complete across all `apps/**`.

## No Correctness Findings

No runtime correctness findings were identified in the font foundation itself:

- `packages/design-system/src/tokens.css:41-180` self-hosted font-face declarations
- `packages/design-system/src/tokens.css:213-242` font tokens
- `apps/web/src/index.css:34-42` global body consumption
- `apps/web/src/components/overlay/CommandPalette/CommandPalette.module.css:55-63`
- `apps/web/src/components/overlay/Tooltip/Tooltip.module.css:35-46`
- `apps/web/src/layouts/RootLayout/RootLayout.module.css:95-103`
- `apps/web/src/views/Home/sections/HomeTopbar.module.css:86-95`
- `apps/web/vite.config.ts:25-39` dev/build font routing

## Gate / Evidence Risks

### 1. Plan status still says the rollout is active, not closed

- Evidence:
  - `docs/plan/font-system-dm-sans-rollout-2026-05-28.md:3`
  - `docs/plan/font-system-dm-sans-rollout-2026-05-28.md:30-34`
- Risk:
  - The plan explicitly keeps `Home` and follow-up pages as later phases.
  - By plan truth, the overall rollout is not complete.

### 2. H5 / H8 / H11 closeout materials are still incomplete

- Evidence:
  - `docs/plan/font-system-dm-sans-rollout-2026-05-28.md:36-41`
  - `.kiro/specs/frontend-style-guide-v5/evidence.md:87`
- Risk:
  - Existing validation and runtime evidence show the implementation mostly works.
  - They do not, by themselves, close review/evidence/visual-contract obligations for declaring the whole wave done.

## Verdict

### a) Is the system-layer font foundation complete?

- Runtime code layer: mostly yes.
- Full definition claimed by this wave:
  - `spec + design-system + font assets + token + gate + active authority truth unified`
- Verdict:
  - not fully complete yet

### b) Can the whole rollout be declared complete now?

- No.

### c) Remaining blockers

1. Resolve the old font truth and Google Fonts residue in `docs/vault/04-design/Frontend Style Guide.html`, so it no longer coexists with the DM Sans route as practical authority.
2. Either expand gate coverage to match the documented `apps/**/src/**` claim, or explicitly narrow the governance wording to web-only.
3. Close the remaining H5 / H8 / H11 review, evidence, and visual acceptance materials for this wave before declaring completion.

## Risk Level

- `MEDIUM`

