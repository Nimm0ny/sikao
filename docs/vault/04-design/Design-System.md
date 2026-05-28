---
type: product
status: active
owner: lhr
last-reviewed: 2026-05-24
spec-source: .kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md
---

# Design System (V5)

> **2026-05-24 V5 整章重写** — replaces the V4 paper / ink / line / accent
> token vocabulary with the three-layer V5 system. The full spec lives at
> `.kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md`;
> this document is the long-term Vault-side mirror.

## SSOT

`packages/design-system/src/tokens.css` is the single token source of
truth. `apps/web/src/index.css` imports it directly via the
`@sikao/design-system/tokens.css` alias. There is no V4 token alias
region — V5-M0.5 (commit ② of the big-bang rebuild) deleted it.

Companion files in this vault:

- [[Web-Layout]] — desktop SaaS shell layout cookbook
- [[Mobile-Layout]] — mobile shell + bottom-tab pattern
- [[Tablet-Layout]] — Rail collapse / drawer behaviors

## Three-layer token architecture

V5 collapses every visual decision into three layers (`design.md §A.1`):

| Layer | Purpose | Theme switch? | Examples |
|---|---|---|---|
| **Primitive** | Raw computable values; never referenced by business code directly. | No | `--color-yellow-500` / `--space-4` / `--radius-16` / `--font-13` |
| **Semantic** | Carries meaning; the **only** layer that swaps between light / dark. | Yes (light ↔ dark / night) | `--color-bg-page` / `--color-text-primary` / `--color-brand-primary` |
| **Component** | Component contracts; stable across themes. | No | `--card-radius` / `--card-padding` / `--btn-h-md` / `--row-h-md` / `--exam-pane-padding` |

### Hard rules (`design.md §A.1` + `tokens.css` enforcement)

1. Business code references **only** the component layer; semantic is
   the fallback when no component token exists; primitive is internal
   to `tokens.css`.
2. Light → dark swap touches only the semantic layer. Primitive +
   component layer values are identical across themes.
3. No raw hex / rgba / `box-shadow:` literal / `z-index: <num>` /
   hardcoded `padding|margin|gap` in `apps/**/src/**`. Enforced by
   `lint-hardcode` / `lint-radius-token` / `lint-shadow-token` /
   `lint-zindex-token` / `lint-spacing-token`.


## Token quick reference

Full table in `packages/design-system/src/tokens.css`; key buckets:

### Primitive layer

- **Spacing** `--space-1..8`: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (mobile
  `<bp-md` halves to 2 / 6 / 10 / 12 / 18 / 24 / 36 / 48)
- **Radius** `--radius-{10,12,16,22,999}`: 10 / 12 / 16 / 22 / pill
- **Type scale** `--font-{display,h1,h2,h3,card,body,meta,tiny}`: 40 /
  32 / 24 / 18 / 16 / 13 / 12 / 11 (mobile compact: 34 / 28 / 20 / 16 /
  14 / 13 / 11 / 10)
- **Font families** `--font-family-{ui,ui-secondary,mono}`: self-hosted
  `DM Sans` / `Inter` / `JetBrains Mono` + system fallback
- **Weight** `--font-weight-{regular,medium,semibold,bold}`
- **Shadow** `--shadow-l1..l4` (l1 card-rest .. l4 toast)
- **Motion** `--ease-{out,emphasized}` / `--dur-{fast,base,emphasized}`

### Font-family rules

- `--font-family-ui` is the global UI default: self-hosted `DM Sans`
  first, `Inter` second, then system CJK fallback.
- `--font-family-ui-secondary` is reserved for dense Latin-heavy UI when
  a future screen needs a more neutral secondary voice.
- `--font-family-mono` is mandatory for `kbd`, mono, and tech metadata.
- Runtime must not request `fonts.googleapis.com` /
  `fonts.gstatic.com`.
- App code must not hardcode `font-family`; use tokens or `inherit`.

### Semantic layer (light + dark / night cover)

- **Surface** `--color-bg-{page,app,surface,elevated,sunken,overlay}`
- **Text** `--color-text-{primary,secondary,meta,meta-soft,disabled,on-brand}`
- **Border** `--color-border-{subtle,default,strong}`
- **Brand + state** `--color-brand-{primary,soft}` /
  `--color-state-{ok,warn,err,info}` + each `*-soft`
- **Categorical** (题型分类色) `--color-cat-{yanyu,shuliang,panduan,ziliao,shenlun}`
- **Focus ring** `--color-focus-ring`

### Component layer

- **Card** `--card-{bg,border,radius,radius-sm,radius-lg,padding,padding-sm,shadow-rest,shadow-hover,title-h,body-min-h,action-divider}`
- **Button** `--btn-h-{sm,md,lg,xl}` (32 / 36 / 40 / 48) + per-size
  padding-x + per-size font
- **Row** `--row-h-{sm,md,lg}` (32 / 40 / 48)
- **Topbar / nav** `--topbar-h` / `--bottom-nav-h` / `--bottom-nav-radius`
- **Rail** `--rail-w` / `--rail-w-expanded` (240) / `--rail-w-collapsed` (80)
- **Z-index ladder** `--z-{rail,topbar,popover,modal,toast}` (20 / 30 /
  40 / 60 / 80, 10-step gaps reserved for third-party slot-in)
- **Exam hooks** `--exam-{pane-padding,divider-handle-w,topbar-h}` (V5
  exposes only these 3 tokens; resize / timer / state-machine logic
  delivered by the dedicated Exam spec, not V5)
- **Content caps** `--max-w-{workspace,reading,form,modal,prose}` —
  `--max-w-workspace = none` (SIK-128 Route A: shared entry-workspace
  default is uncapped; reading/form/prose keep explicit narrow caps)
- **Mobile** `--mobile-{topbar-h,bottom-nav-h,rail-drawer-w}` /
  `--touch-target-min` 40 / `--sheet-handle-{w,h}`


## Breakpoints + Rail collapse rules (§C.4)

| Token | min-width | Battlefield | Rail | Workspace |
|---|---|---|---|---|
| `--bp-xs` | 375px | mobile portrait | hidden | single column |
| `--bp-sm` | 480px | large mobile / fold | hidden | single column |
| `--bp-md` | 768px | iPad portrait | hidden, drawer-on-burger | two-column allowed, compact |
| `--bp-lg` | 1024px | iPad landscape / 13" laptop | collapsed 80px | comfortable |
| `--bp-xl` | 1280px | desktop default | expanded 240px | standard |
| `--bp-2xl` | 1536px | **1920 main-stage** (workspace fills Rail-remaining width) | expanded 240px | standard |
| `--bp-3xl` | 1920px | ultra / 4K | expanded 240px | standard |

### Rail collapse state machine (§C.4.3)

V5 fixes V4's "max-width 1180 一刀切" with three regimes:

- **768 – 1279**: default collapsed (80px).
- **≥ 1280**: default expanded (240px).
- `localStorage['v5-rail-collapsed']` persists user override across
  resolutions; controlled `collapsed` prop wins above both.
- Toggle hotkey `Ctrl/Cmd + \\`. Toggle button is **hidden** in the
  collapsed state — the entire brand area becomes the click target
  (icon-only with Tooltip).
- Mobile (< `bp-md`) hides the Rail entirely; AppShell drops the
  slot from the DOM tree (defense-in-depth on top of CSS `display:
  none`).

## 35-component contract quick reference

V5 ships 35 component skeletons across 8 group folders + 1 layouts
folder (full prop API in `design.md §D.3.1 – §D.3.35`). The Vault
mirror lists names + the SSOT-relevant decisions; **always read the
spec for the canonical contract**.

### Hard rules across the suite

1. **No emoji icons** anywhere in `apps/**/src/{views,components}/**`
   (icons → SVG sprite at `apps/web/public/icons.svg`, sources at
   `packages/design-system/src/icons/*.svg`). Enforced by
   `lint-no-emoji-as-icon` + `lint-practice-svg-only`.
2. **`:hover` rules MUST be wrapped in
   `@media (hover: hover) and (pointer: fine)`** so touch devices
   don't carry hover residue. Enforced by `lint-touch-target`.
3. **Tabs / SegmentedControl merged**: V5 has no separate
   `<SegmentedControl>` component. The 3 visual variants live on
   `<Tabs>`: `underline` / `pill` / `segmented` (R2/Q2 decision). The
   business-named alias `<ScopeToggle>` is a thin wrapper over
   `<Tabs variant="segmented">` for the 行测/申论 scope flip pattern;
   it MUST NOT spawn an independent implementation.
4. **Note detail uses `<Drawer side="right" size="lg">`, NOT Modal**
   (R2/Q1 + §D.3.35 gotcha). Modal's 640px max would crowd the
   rich-text editor and lose the notes-wall context. Mobile auto-
   converts to `<Sheet side="bottom">`.
5. **Exam never reuses the SaaS shell** (§D.3.35 gotcha + §D.4.6).
   Exam pages render `<ExamLayout>` directly; nesting `<AppShell>` /
   `<Rail>` inside Exam is forbidden. Use the 3 exam hook tokens
   above; resize / timer / sheet stacking ship with the dedicated
   Exam spec.
6. **OptionItem (D.3.28) is the only valid answer-option primitive**
   — vanilla `<Radio>` MUST NOT be used to model question options.
   Visual weight, review-mode behavior and a11y semantics differ.
7. **Destructive operations MUST go through `<ConfirmDialog>` with
   `destructive` prop** (D.3.22) — 交卷 / 退出考试 / 删除笔记 /
   注销账号 / 清缓存 etc. Plain Modal is forbidden for these.


### Component inventory

| Group | Components | Spec ref |
|---|---|---|
| **system** | VisuallyHidden / FocusTrap / Divider / KeyboardShortcuts | §D.3.34 |
| **atom** | Avatar / Badge / Tag / Chip / Numeric / ProgressLinear / ProgressRing / EmptyState / Skeleton | §D.3.8-10 / 18 / 27 |
| **form** | Button / Input / Radio / Checkbox / Switch / Textarea / Select / Slider / Search / DatePicker / TimePicker / FormField | §D.3.1-2 / 11-17 |
| **list** | ListItem | §D.3.4 |
| **nav** | Tabs / Pagination / Breadcrumb | §D.3.3 / 24 / 25 |
| **overlay** | Popover / Tooltip / Banner / Modal / Sheet / Drawer / ConfirmDialog / Toast / ToastProvider / CommandPalette | §D.3.5-7 / 19-23 / 26 |
| **business** | ScopeToggle / OptionItem / QuestionStem / AnswerSheet / TimerDisplay | §D.3.3 (alias) / 28-31 |
| **layout** | AppShell / Rail / Workspace / Panel / PageHeader / Section / MobileAppShell / MobileTopBar / BottomTabBar | §D.3.32-33 |
| **layouts/** | RootLayout (V5-M3.5) / ExamLayout (V5-M3) | §D.4 / §D.4.6 |

### Page container trees (§D.4)

- **D.4.1 Home** — 4-row grid: PageHeader → MetricRow × 4 → Calendar
  Panel (1.6fr) → BottomRow × 3
- **D.4.2 Practice** — 4-row grid: PageHeader (with ScopeToggle 行测/
  申论) → row1 224 → 192px under `@media (max-height: 800px)` (laptop
  ergonomics) → specialty 4-col grid → paper 4-col grid
- **D.4.3 Note** — 3-row grid + Drawer: header → FilterBar (chip
  multi-select; active state inverted black) → SubBar → sticky cards
  with -2..+2deg tilt; click → `<Drawer side="right" size="lg">`
- **D.4.4 Me** — 4-row grid: header → MeHero (Avatar + name + 3 stat
  cells) → MeGrid 2-col → 危险操作 Panel `variant="danger"` spanning
  both columns; 注销账号 → `<ConfirmDialog destructive>`
- **D.4.5 Question Hub / Review** — 3-row grid: header → FilterBar
  → Panel with compact 3-col grid (`--card-radius-sm` 12px); Review
  adds a calendarBar with `<DatePicker>` default presets (今天 /
  明天 / 下周一)
- **D.4.6 Exam-Shenlun / Exam-Xingce** — separate layout, NOT inside
  AppShell. ExamLayout = ExamTopBar + 2-pane PanelGroup + Sheet (草稿
  纸); resize / timer / state-machine in the dedicated Exam spec

## Cards (§B)

5 card types × 9 states (rest / hover / pressed / focus / loading /
error / disabled / selected / dragging). Visual contracts in
`design.md §B.1-B.5`. Common surface vocabulary:

- **Card-shell** uses `--card-{radius,padding,bg,border,shadow-rest}`.
- **Nested cards** must satisfy: outer radius ≥ inner radius AND outer
  − inner ≥ 4px (CP.3 invariant).
- **Card-shadow-hover** only fires inside
  `@media (hover: hover) and (pointer: fine)`.
- **Sticky note variant (Note D.4.3)** ships a bespoke shadow planned
  for `--sticky-shadow-{rest,hover}` token pair (Phase 5+ design-
  system follow-up; Phase 4 skeleton uses `--card-shadow-rest` placeholder).


## Type scale + CJK rules

| Token | px | Bucket | Notes |
|---|---|---|---|
| `--font-display` | 40 | hero / cover h1 | mobile compact 34 |
| `--font-h1` | 32 | page h1 | mobile 28 |
| `--font-h2` | 24 | section h2 | mobile 20 |
| `--font-h3` | 18 | card title h3 | mobile 16 |
| `--font-card` | 16 | card title / button label | mobile 14 |
| `--font-body` | 13 | body / button | mobile 13 |
| `--font-meta` | 12 | meta / chip / badge | mobile 11 |
| `--font-tiny` | 11 | tiny uppercase / footnote | mobile 10 |

### CJK no-italic invariant (CP.4)

Any node containing CJK characters MUST NOT carry `font-style: italic`,
`<i>`, or Tailwind `italic` class. Enforced by `lint-italic.mjs`. The
V4 三类例外 (serif 数字 / ASCII editorial / error-svg) are V4-specific
and have NOT been carried over — V5 ships no italic CJK at all.

QuestionStem reading-density dial (§D.3.29) is a spec-pinned
exception: 4 buckets at 14 / 15 / 17 / 19px live as raw `font-size`
literals on `[data-font-size='..']` selectors, on purpose, because
reading density is not part of the type ramp (R1/Q3 decision). All
other component / view code MUST resolve font-size through the table
above.

## Lint enforcement matrix

| Lint script | Property | Status |
|---|---|---|
| `lint-shadow-token` | CP.1 (token SSOT, shadow) | active |
| `lint-zindex-token` | CP.1 (token SSOT, z-index) | active |
| `lint-spacing-token` | CP.1 (token SSOT, spacing) | active |
| `lint-radius-token` | CP.1 (token SSOT, radius) | active |
| `lint-hardcode` | CP.1 (token SSOT, color literals + Tailwind defaults) | active |
| `lint-italic` | CP.4 (CJK no-italic) | active |
| `lint-touch-target` | CP.9 (hover-touch affordance + ≥40px hit area) | active |
| `lint-icon-style` | CP.5 (SVG-only icon style contract) | active |
| `lint-icon-button` | (a11y) icon-only button MUST have aria-label | active |
| `lint-no-emoji-as-icon` | CP.5 (no emoji as icon) | active |
| `lint-practice-svg-only` | CP.5 (practice/essay buttons SVG-only) | active |
| `lint-cn-simplified` | i18n hygiene (no traditional CN drift) | active |
| `lint-v4-token-residual` | CP.8 (regression guard — 0 V4 names) | active (post-big-bang regression guard) |
| `lint-font-family-token` | typography governance | active |
| `lint-external-font-hosts` | self-host / no external font runtime | active |
| `lint-ui-copy-ssot` | content SSOT (`@/lib/ui-copy`) | warn-only (Phase 8+ promotion to error) |

`apps/web/v5-baseline-report.md` (Phase 7 task 23.1) records the
baseline run: **0 hard-fail violations**, 2 warn-only items in
Pagination + CommandPalette pre-existing strings.

## Visual regression baseline (Phase 7 task 23.2)

`apps/web/playwright.config.ts` + `apps/web/e2e/visual/*.spec.ts`
ship 6 viewport projects (xs 375 / sm 480 / md 768 / lg 1024 / xl
1280 / 3xl 1920) × 6 desktop pages (Home / Practice / Note / Me /
Question Hub / Review) = 36 baseline screenshots per run. Snapshot
PNGs are gitignored across cross-platform pixel-rendering drift; each
environment regenerates via `npm run test:visual:update -w @sikao/web`.

dev port fixed at **18080** (`vite.config.ts` `--strictPort`,
AGENT-H10 hard rule). No docker.

## Fail-fast exceptions

V5 has exactly one approved fail-fast exception: the BottomTabBar
glassmorphism fallback (`mobile-bottom-nav-glassmorphism-fallback`).
Registered at
[fail-fast-exceptions.md#mobile-bottom-nav-glassmorphism-fallback](../../engineering/fail-fast-exceptions.md).

All other catch / `?? defaultValue` / `|| defaultValue` / silent
fallback patterns are forbidden. AGENT-H7 governs.

## Status

`active` — V5 spec all 8 phases delivered (M0 / M0.5 / M1 / M2 / M3 /
M3.5 / M4 / M9 / M11). The full evidence trail lives at
`.kiro/specs/frontend-style-guide-v5/evidence.md` once Phase 8 closes
the spec.

## Related Vault entries

- [[Frontend Style Guide.html]] — historical reference only; not current font authority (superseded by V5 + DM Sans route)
  historical context; superseded by this document + spec triplet)
- [[Web-Layout]] — desktop SaaS shell layout cookbook
- [[Mobile-Layout]] — mobile shell + bottom-tab pattern
- [[Tablet-Layout]] — Rail collapse / drawer behaviors
- [[../03-tech/Architecture]] — system architecture overview
- [[../05-migration/Phase/Style-Guide-V5/00-Index]] — V5 phase docs
  hub
