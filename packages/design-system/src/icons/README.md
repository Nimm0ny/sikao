# V5 icon sources

Single source of truth for the V5 SVG icon sprite. Each `<icon-name>.svg`
file in this directory becomes a `<symbol id="<icon-name>">` entry in
`apps/web/public/icons.svg` after running:

```sh
npm run build:icons -w @sikao/design-system
```

## File naming (per design.md §C.5.6)

- File stem = symbol id, kebab-case: `chevron-left.svg` →
  `<symbol id="chevron-left">`.
- Filled variants: `<name>-filled.svg` (e.g. `check-filled.svg`); the
  build script preserves `fill="currentColor"` and drops stroke checks.
- Categorical icons: `cat-<key>.svg` matching the V5 §2.5 cat-* token
  set (cat-yanyu / cat-shuliang / cat-panduan / cat-ziliao / cat-shenlun).
- Rail nav icons: `nav-<key>.svg` (nav-home / nav-practice / nav-review /
  nav-note / nav-question).

## Style contract (enforced by `lint-icon-style.mjs`)

Outline icons (default):

- `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`
- `stroke-width` ∈ {1.5, 1.6, 1.7, 1.8, 2.0} per V5 §C.5.1 size ladder

Filled variants (`*-filled.svg`):

- `viewBox="0 0 24 24"`
- `fill="currentColor"` (every fill attribute that is not "none")
- Stroke attributes optional but allowed for hairline detail.

## Adding a new icon

1. Drop `<icon-name>.svg` into this directory authored against the style
   contract above.
2. Run `npm run build:icons -w @sikao/design-system` to refresh
   `apps/web/public/icons.svg`.
3. Run `npm run lint:icon-style -w @sikao/web` to verify the style
   contract.
4. Reference in code as
   `<svg width={...} height={...} aria-hidden="true"><use href="/icons.svg#<icon-name>" /></svg>`.

## Phase 5 batch ordering (SIK-76 / V5-M4)

- 19.1 batch A — answering nav: chevron-left, chevron-right, bookmark,
  highlighter, trash, timer
- 19.2 batch B — answering control: pause, play, type, scratch-pad, submit
- 19.3 batch C — answering aux: answer-sheet, notebook, settings, exit
- 19.4 Rail aux — rail-toggle, search, burger
- 19.5 status (outline + filled): check, close, warning, info × 2 = 8
- 19.6a categorical: cat-yanyu, cat-shuliang, cat-panduan, cat-ziliao,
  cat-shenlun
- 19.6b Rail nav: nav-home, nav-practice, nav-review, nav-note,
  nav-question
