---
type: design
status: active
owner: lhr
last-reviewed: 2026-05-09
---

# SIKAO SVG Icon Design System

> Source of truth for all SVG icons used in the SIKAO product. The xingce / essay
> answering systems are governed by a hard "**SVG-only, no text labels**" constraint
> (see CLAUDE.md §4 — buttons MUST be SVG icons + `aria-label`, never `📌 标记`,
> never `<button>收藏</button>`). This document defines the visual grammar so every
> icon — **including composite numbered icons** like 题号圆 / `M1` 材料编号 / `Q1`
> 问题编号 — feels carved from the same block of paper.
>
> **Tone**: ink-first neutrals + blue accent `--accent: #3f7ef1` + 1.4px stroke + sharp
> corners. Icons inherit `--accent` from the project token system; this document
> must not bind icons to red or warm legacy tokens.
>
> Companion files:
> - `composite-icons-spec.md` — 题号圆 / `Mn` / `Qn` etc. (the load-bearing piece)
> - `icon-inventory.html` — visual catalog
> - `usage-rules.md` — quick-reference for engineers

---

## 1. Visual Language

The SIKAO icon language is a **single coherent system**. Every glyph follows the
same grid, weight, joint style, and color discipline so that scattering 50+ icons
across topbars, FbDock, MmStrip, EditorPanel never feels noisy.

### 1.1 Geometry

| Property | Value | Why |
|---|---|---|
| Default `viewBox` | `0 0 24 24` | Matches SIKAO sidebar logo / nav. Renders crisp at 14/16/18/24/32. |
| Compact `viewBox` | `0 0 16 16` | Inline within text or chip — match SIKAO's existing 16-grid icons (chevron-left, settings, mark…). 16 and 24 are the only allowed grids. **Never** 18, 20, 22. |
| `stroke-width` | `1.4` (default) / `1.5` (sidebar nav) | 1.4 for chip / topbar / FbDock; 1.5 for sidebar (slightly bolder when icon is the entire nav target). Pick **one** per surface, do not mix. |
| `stroke` | `currentColor` | Token control via parent `color`. **No hex inside SVG.** |
| `fill` | `none` (default outline) / `currentColor` (filled state, e.g. `StarFilled`) | Default is outline. Fill only signals state change. |
| `stroke-linecap` | `round` | Soft terminations match the ink-first interface. |
| `stroke-linejoin` | `round` | Same. |
| Grid | 1px | All paths align to integer pixels in the 24-grid. No 0.5 offsets except for circle radii (`r="11"` is the only half-step). |
| Corners | Sharp (no rounded path corners except `linejoin: round`) | ink-first 工具感; matches SIKAO 'no rounded chubby cards'. |
| Optical adjustment | Allowed for visual balance only | e.g. arrow head 3px off baseline. Document per-icon if used. |

### 1.2 Anti-patterns (instant reject)

- x Hard-coded accent hex values - never inline brand colors. Use `currentColor`.
- ❌ `stroke-width="2"` — too heavy for the paper aesthetic.
- ❌ `stroke-width="1"` — thins out at smaller sizes; reads as broken.
- ❌ `viewBox="0 0 20 20"` — pick 16 or 24, not in-between.
- ❌ `<image href="...png">` — raster images are not icons.
- ❌ Drop shadows / gradients / multi-color fills — SIKAO is monochrome + accent.
- ❌ Emoji as fallback — `📌` `⭐` `📝`. Hard-banned even in placeholders.
- ❌ Icons that need a label to be understood (icon should communicate alone or via `aria-label`).
- ❌ Icons with text inside the SVG (use the React `<text>` overlay pattern from §6 / composite-icons-spec.md instead).

---

## 2. Naming Convention

### 2.1 File names

```
frontend/src/icons/
  nav/      NavPrevIcon.tsx          NavNextIcon.tsx          NavBackIcon.tsx
            NavCloseIcon.tsx         NavAnswerCardIcon.tsx
  tool/     ToolPauseIcon.tsx        ToolPlayIcon.tsx         ToolSettingsIcon.tsx
            ToolThemeIcon.tsx        ToolScratchIcon.tsx      ToolPinIcon.tsx
            ToolUndoIcon.tsx         ToolRedoIcon.tsx         ToolSearchIcon.tsx
            ToolSortIcon.tsx         ToolFilterIcon.tsx       ToolDownloadIcon.tsx
            ToolEyeIcon.tsx          ToolFullscreenIcon.tsx   ToolAiIcon.tsx
            ToolChatIcon.tsx         ToolSendIcon.tsx
  action/   ActionStarIcon.tsx       ActionStarFilledIcon.tsx
            ActionMarkIcon.tsx       ActionMarkFilledIcon.tsx
            ActionNoteIcon.tsx       ActionNoteEditIcon.tsx
            ActionBookmarkIcon.tsx
  status/   StatusDoneIcon.tsx       StatusWrongIcon.tsx      StatusPendingIcon.tsx
            StatusCurrentIcon.tsx    StatusLockedIcon.tsx
  subject/  SubjectXingceIcon.tsx    SubjectEssayIcon.tsx     SubjectWrongbookIcon.tsx
            SubjectDashboardIcon.tsx SubjectPlanIcon.tsx      SubjectProfileIcon.tsx
            SubjectHomeIcon.tsx
  composite/
            NumberCircle.tsx         NumberSquare.tsx
            MaterialBadge.tsx        QuestionBadge.tsx
  index.ts                           // re-exports the whole inventory
```

### 2.2 Rules

1. **Prefix is the category** — `Nav` / `Tool` / `Action` / `Status` / `Subject` / `Composite`.
2. **Suffix is the state** — bare = default outline; `-Filled` = filled variant; `-Active` / `-Disabled` / `-Done` / `-Wrong` when state changes the glyph itself.
3. **Lowercase props, PascalCase component**. `<NavPrevIcon size="md" />`.
4. **No abbreviations** in component names (`ToolSettings`, not `ToolSet`). Industry-standard tokens (`Ai`, `Url`, `Id`) are allowed.
5. **One file per icon**. Never group `<StarIcon />` and `<StarFilledIcon />` in one file — diff churn and tree-shaking suffer.
6. **Composite icons** live in `composite/` and have their own typed props (see `composite-icons-spec.md`).

### 2.3 React component skeleton

```tsx
// frontend/src/icons/action/ActionStarIcon.tsx
import type { IconProps } from '@/icons/types';
import { iconSizeMap } from '@/icons/sizes';

export function ActionStarIcon({ size = 'md', className, ...rest }: IconProps) {
  const px = iconSizeMap[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M12 3.5l2.6 5.3 5.7.8-4.2 4.1 1 5.7L12 16.7l-5.1 2.7 1-5.7-4.2-4.1 5.7-.8z" />
    </svg>
  );
}
```

The shared `IconProps` enforces (a) `size` is a token, not a number; (b) `aria-hidden`
defaults to true (icon is decorative when wrapped by `IconBtn`).

```tsx
// frontend/src/icons/types.ts
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: IconSize;
  className?: string;
}
```

---

## 3. Size Tokens

| Token | Pixel | Use cases |
|---|---|---|
| `xs` | 14 | Inline within body text (rare). MetricCard delta arrow. |
| `sm` | 16 | Inside `Chip` / `.tag` / inline meta / FbCard 操作条 (★ ⤴ 📝 三键). Default for SIKAO 16-grid icons. |
| `md` | 18 | Default `IconBtn` content (32×32 outer / 18 inner / 7px padding). Topbar buttons. |
| `lg` | 24 | Sidebar nav (`SubjectHomeIcon` etc.). Toolbar prominent triggers. Standalone hero icons. |
| `xl` | 32 | Major CTA glyphs (`SubmitIcon` next to "提交"). 答题卡题号 cell when displayed at 32px scale. **Use sparingly** — only one xl icon per surface region. |

**Source of truth**:
```ts
// frontend/src/icons/sizes.ts
export const iconSizeMap: Record<IconSize, number> = {
  xs: 14, sm: 16, md: 18, lg: 24, xl: 32,
};
```

**Hard rule**: never pass numeric `size={20}` from a call site. Either the size is in
the table above, or you add a token here (and we discuss why). This prevents the
"each engineer picks their own" drift.

---

## 4. State Color System (token-driven)

Color is **always** transmitted via `color` on the parent. Inside the SVG it is
`currentColor`. Direct tokens used:

| State | Token | Usage |
|---|---|---|
| **default** | `var(--ink)` `#1A1815` | Resting glyph on paper background. |
| **subdued** | `var(--ink-3)` `#6B6358` | Disabled, pending, low-emphasis (FbDock 未答 number). |
| **muted** | `var(--ink-4)` `#948A7A` | Even quieter (Skeleton placeholder, locked Q4). |
| **active / accent** | `var(--accent)` `#3f7ef1` | Current selection, marked, primary CTA. Uses the project blue accent token. |
| **success** | `var(--ok)` `#4F7A4F` | Correct answer, submitted Q. |
| **destructive** | `var(--bad)` | Wrong answer. Keep destructive state separate from `--accent`; do not bind icons to red or warm legacy tokens. |
| **on-ink (inverse)** | `var(--paper)` `#FAF7F0` | When sitting on filled `--ink` background (filled NumberCircle 已答态, primary Button glyph). |
| **warn** | `var(--warn)` | Rare save retry or timeout state. |

```css
/* example IconBtn state stack */
.icon-btn { color: var(--ink); }
.icon-btn:hover { color: var(--ink); background: var(--paper-2); }
.icon-btn[data-pressed="true"] { color: var(--accent); }   /* marked / starred */
.icon-btn[disabled] { color: var(--ink-4); pointer-events: none; }
.icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

---

## 5. IconBtn Container

`IconBtn` is the standard interactive wrapper. **Never put a raw `<svg>` inside a
`<button>` directly** — always go through `IconBtn` so a11y / focus / state are
unified.

### 5.1 Spec

| Property | Default | Variant |
|---|---|---|
| Outer size | `32 × 32` | `40 × 40` for mobile (touch target ≥ 44 effective with margin) |
| Inner SVG | `18 × 18` | scales with `size` prop (sm=16, md=18, lg=24) |
| Padding | `7px` | computed: `(outer − inner) / 2` |
| Shape | `border-radius: 0` (square, ink-first) | `border-radius: var(--r-sm)` for `variant="chip"` only |
| Background (rest) | `transparent` | `paper-2` for `variant="filled"` |
| Background (hover) | `var(--paper-2)` | — |
| Background (active / pressed) | `var(--paper-3)` | — |
| Border | `none` | `1px solid var(--rule)` for `variant="bordered"` (used in EditorPanel toolbar) |
| Focus ring | `outline: 2px solid var(--accent); outline-offset: 2px;` | Never remove. |
| Disabled | `opacity: 0.4; cursor: not-allowed;` | — |
| Transition | `background 120ms ease, color 120ms ease` | Match CLAUDE.md §11.5 fenbi 系 polish (120ms). |

### 5.2 Required ARIA

```tsx
<IconBtn
  aria-label="收藏"          // mandatory, in Chinese
  aria-pressed={isStarred}   // for toggle behaviors (star, mark)
  onClick={toggleStar}
>
  {isStarred ? <ActionStarFilledIcon /> : <ActionStarIcon />}
</IconBtn>
```

| Attribute | When required |
|---|---|
| `aria-label` | **Always** for icon-only buttons. Chinese. |
| `aria-pressed` | For toggle states (star / mark / pin / theme). |
| `aria-current="page"` | For sidebar nav active item. |
| `aria-expanded` | For triggers that open menus / drawers (settings drawer, answer-card drawer). |
| `aria-hidden="true"` | On the `<svg>` itself when wrapped by IconBtn (the button carries the label). |
| `title` attribute | **Never** — use the design-system `Tooltip` primitive. |

### 5.3 IconBtn TS contract

```ts
interface IconBtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  'aria-label': string;          // required (note: enforced by TS via this overload)
  size?: 'sm' | 'md' | 'lg';     // 28 / 32 / 40 outer
  variant?: 'plain' | 'filled' | 'bordered' | 'chip';
  pressed?: boolean;             // sets aria-pressed AND data-pressed
  tone?: 'default' | 'accent' | 'success' | 'destructive';
  children: React.ReactElement;  // exactly one icon
}
```

**Note** — `aria-label` is intentionally `required`. TypeScript will fail the
build for any `<IconBtn>` missing it. This is the SVG-only constraint
mechanically enforced.

---

## 6. SVG-only Hard Constraint (per CLAUDE.md §4)

> **Quoted from CLAUDE.md §4 / SIKAO handoff CLAUDE.md §3**:
>
> 行测 / 申论答题系统所有按钮必须 **SVG-only**，不允许文字 label，aria-label 兜底。
> 不要 emoji 当图标 — 用 SVG. 文档里 ★⤴⌾⏸ 仅作占位，落地必须替成线性 SVG.

### 6.1 What's banned

| Pattern | Status |
|---|---|
| `<button>收藏</button>` | ❌ Banned in xingce/essay surfaces. |
| `<button>📌 标记</button>` | ❌ Banned everywhere — emoji icon always banned. |
| `<button title="..."><svg/></button>` | ❌ Use `Tooltip` primitive. |
| `<svg>` inline without `currentColor` | ❌ |
| `<button><svg/> 收藏</button>` (icon + text) | ⚠️ Only allowed for **the single primary CTA per surface** in the dock submit footer. Topbar and dock triggers stay icon-only. |

### 6.2 The single allowed exception — primary CTA

```tsx
// FbDockSubmitFooter submit button — the ONE place icon+text can coexist
<Button variant="primary">
  <NavSubmitIcon /> 提交
</Button>
```

Rules around this exception:
- ≤ 1 icon+text Button per view (a Drawer / Modal can have its own).
- Only `FbDockSubmitFooter` / dock footer may use this primary CTA. `FbTopbar` submit stays an SVG-only `IconBtn`.
- Must be a `Button.primary`, never a secondary button.
- Icon comes **before** text (LTR convention).
- Background `var(--ink)`, foreground `var(--paper)`.

### 6.3 Composite icons opt out of "SVG-only"

Numbered icons like `M1` / `Q3` / 题号圆 contain text **inside** the SVG (rendered
via `<text>` element). This is by design — see `composite-icons-spec.md`. They are
NOT regular icons; they are tightly-bound visual primitives where the number is
data, not label. The "no text in icon" rule does not apply to the `Composite/`
namespace.

---

## 7. Accessibility

### 7.1 Decorative vs interactive

```tsx
// Decorative (icon next to a labelled trigger) — hide from AT
<button aria-label="设置">
  <ToolSettingsIcon aria-hidden="true" />
</button>

// Standalone meaning (rare — usually you should use IconBtn)
<ToolEyeIcon role="img" aria-label="只读模式" />
```

### 7.2 Keyboard

- `IconBtn` is a real `<button>` — Enter / Space activate.
- Toolbar groups: arrow keys navigate (use `role="toolbar"` on the wrapper).
- Focus outline never removed. `outline: 2px solid var(--accent)`.

### 7.3 Color contrast

All icon colors meet WCAG AA at 18×18:

| Foreground | Background | Ratio | OK? |
|---|---|---|---|
| `--ink` `#1A1815` | `--paper` `#FAF7F0` | 13.8:1 | ✅ |
| `--ink-3` `#6B6358` | `--paper` | 5.1:1 | ✅ |
| `--ink-4` `#948A7A` | `--paper` | 3.0:1 | ⚠️ "muted" only — not for primary content |
| `--accent` | `--paper` | Covered by project token contrast checks | OK |
| `--paper` | `--ink` (filled NumberCircle 已答) | 13.8:1 | ✅ |
| `--accent` | `--accent-50` | Covered by project token contrast checks | OK |

In `night` theme the inverse pair is used and tested separately (see Appendix).

### 7.4 Reduced motion

```css
.icon-btn { transition: background 120ms ease, color 120ms ease; }
@media (prefers-reduced-motion: reduce) {
  .icon-btn { transition: none; }
}
```

### 7.5 Focus order

Icons in toolbars must reflect natural reading order. Flex `gap` not `flex-direction: row-reverse`. Test with Tab.

---

## 8. Theming (ink-first / pure / night)

The icon system has **zero theme-specific code** — colors flow through tokens.
A single icon reuses across all three themes:

| Theme | `--ink` | `--paper` | `--accent` | Filled-NumberCircle |
|---|---|---|---|---|
| ink-first (default) | project token | project token | project blue accent token | ink-fill on paper bg |
| pure | project token | project token | project blue accent token | same, looks crisper |
| night | project token | project token | project blue accent token | inverted automatically |

Engineers do nothing per-theme. If an icon looks wrong in night mode, the
*token* is wrong, not the icon — fix it in `tokens.css`.

---

## 9. Performance & build

- Tree-shake-friendly: each icon a separate file, all `index.ts` re-exports are
  named (no `export *`).
- No SVG sprite sheet — they prevent tree-shaking and complicate `currentColor`
  usage when nested.
- Total inventory ~50 icons, average 600 bytes each → ~30KB gzipped raw.
  Realistic loaded surface: 8–12 icons per page → < 8KB.
- No SVGO at runtime; pre-optimized at author time. Strip `<title>` elements
  (they break `aria-label` overrides) and any unused `xmlns:xlink`.

---

## 10. Token discipline (zero-tolerance lint targets)

The following is enforced by `npm run lint:hardcode` and `npm run lint:radius-token`
(see `frontend/scripts/`). New rule: `lint:icon-tokens` (to be added) checks the
`frontend/src/icons/` tree for the patterns below.

| Violation | Lint rule | Severity |
|---|---|---|
| Hex color inside SVG | `lint:icon-tokens` (planned) | error |
| `stroke-width` ∉ {1.4, 1.5, 2 (warn for now)} | `lint:icon-tokens` | error |
| `viewBox` ∉ {`0 0 16 16`, `0 0 24 24`} | `lint:icon-tokens` | error |
| `rounded-[Npx]` on IconBtn wrapper | `lint:radius-token` | error |
| Tailwind default `rounded-md` / `rounded-lg` on IconBtn | `lint:radius-token` | error |
| `font-style: italic` inside SVG | `lint:italic` | error |
| Numeric `size={20}` on icon | `lint:icon-tokens` | error |
| Missing `aria-label` on `IconBtn` | TS compile error (see §5.3) | block build |

Escape hatch: line-end `// icon-allow: <reason>` (matches the `hardcode-allow` pattern).
Use sparingly. Each escape needs a code review approval.

---

## 11. Worked example — converting the existing 24 SIKAO icons

The 24 icons in `extracted/inline-svgs.md` (chevron-left, settings, download,
check, star, note, mark, ai, eye, send, logo, home, calendar, practice, essay,
bookmark, chart, ai-chat) are the **seed inventory**. Conversion rules:

1. `viewBox="0 0 16 16"` → keep as-is for chip-grade icons (chevron-left, settings,
   download, check, star, note, mark, ai, eye, send). Their natural display size
   is 14–16px; upscaling to 24-grid would require redrawing.
2. `viewBox="0 0 24 24"` → keep (logo, home, calendar, practice, essay, bookmark,
   chart, ai-chat). These are sidebar / nav icons displayed at 18–24px.
3. **Replace** `stroke="currentColor" fill="none"` literal attrs that should be
   `<g stroke="currentColor" fill="none">` parent groups for cleaner JSX.
4. Add `aria-hidden="true"` (the IconBtn carries the label).
5. Wrap in component shell from §2.3.

Implementation tracking: `frontend/src/icons/_seed-from-html.md` (mirrors the seed list with conversion status). To be created in the icon-implementation phase.

### 11.1 New icons needed beyond the seed 24

Required for full xingce / essay coverage but NOT in the seed:

| Category | Icon | Reason |
|---|---|---|
| Nav | `NavNextIcon` | seed has only `prev`. |
| Nav | `NavCloseIcon` | Drawer / Modal close — seed missing. |
| Nav | `NavAnswerCardIcon` | Topbar 答题卡 trigger — currently a text label in the HTML; convert to icon. |
| Nav | `NavSubmitIcon` | seed has `check` (close enough but rename for semantics). |
| Tool | `ToolPauseIcon` / `ToolPlayIcon` | Topbar timer space-bar pause — currently text. |
| Tool | `ToolThemeIcon` | Theme switcher — was Tweaks panel only. |
| Tool | `ToolScratchIcon` | Toggle ScratchPad visibility (Q4 大作文模式). |
| Tool | `ToolPinIcon` | Pin a clip on ScratchPad. |
| Tool | `ToolUndoIcon` / `ToolRedoIcon` | EditorPanel & MaterialPanel highlight ops. |
| Tool | `ToolFullscreenIcon` | EditorPanel 专注大作文 mode. |
| Tool | `ToolSortIcon` / `ToolFilterIcon` | Wrongbook list controls. |
| Action | `ActionStarFilledIcon` | toggle pair for `star`. |
| Action | `ActionMarkFilledIcon` | toggle pair for `mark`. |
| Action | `ActionNoteEditIcon` | "你已写过笔记" 状态版. |
| Status | `StatusDoneIcon` | green ✓ for submitted Q / correct answer. |
| Status | `StatusWrongIcon` | red ✗ for wrong answer. |
| Status | `StatusPendingIcon` | hollow circle for unanswered. |
| Status | `StatusCurrentIcon` | filled accent dot for current item. |
| Status | `StatusLockedIcon` | lock for Q4 (locked until Q3 done). |
| Subject | `SubjectProfileIcon` | sidebar — seed missing user / profile. |
| Subject | `SubjectAuthIcon` | login / register marketing. |
| Composite | `NumberCircle` / `NumberSquare` / `MaterialBadge` / `QuestionBadge` | All 4 covered in `composite-icons-spec.md`. |

Total new icons: **~22**. Combined with the 24 seed → **~46 atomic icons + 4
composite primitives**. Inventory rendering in `icon-inventory.html`.

---

## 12. Governance

1. **Add a new icon** = (a) draw in the design canvas, (b) match grid + stroke width, (c) write component file, (d) add to `index.ts`, (e) add to `icon-inventory.html`, (f) lint passes. PR triggers Master review (CLAUDE.md §3 rule 4 — > 400 LOC threshold rare here, but visual-system PRs always do go through 前端规范审查官 subagent).
2. **Modify an existing icon** = back-compat warning. If a public path/glyph changes, bump a `data-version` attribute or rename the component. The seed 24 icons in particular are referenced from spec docs — modifying them ripples.
3. **Token changes** (e.g. `--accent` shifts) propagate automatically; no icon needs touching.
4. **Composite icon contract changes** (e.g. add a 6th status to `NumberCircle`) require a brand decision memo in `docs/design/decisions/` before code lands.

---

## Appendix A — Quick reference for engineers

| I want to… | Use |
|---|---|
| 32×32 button with an icon | `<IconBtn aria-label="..."><XxxIcon /></IconBtn>` |
| Inline icon next to text in a chip | `<XxxIcon size="sm" />` (no IconBtn) |
| 题号 1-50 in 答题卡 | `<NumberCircle number={n} status="..." ariaLabel="..." />` |
| 申论 M1-M9 切换 tab | `<MaterialBadge index={n} status="..." count={n} />` |
| 申论 Q1-Q4 切换 tab | `<QuestionBadge index={n} status="..." wordCount="..." />` |
| 主 CTA 提交按钮 | `<Button variant="primary"><NavSubmitIcon /> 提交</Button>` |
| Tooltip on icon | `<Tooltip label="..."><IconBtn ... /></Tooltip>` (never `title=`) |

## Appendix B — Filesystem layout (final)

```
frontend/src/
  icons/
    _seed-from-html.md          // tracking conversion of 24 SIKAO seed icons
    types.ts                    // IconProps, IconSize
    sizes.ts                    // iconSizeMap
    nav/        *.tsx
    tool/       *.tsx
    action/     *.tsx
    status/     *.tsx
    subject/    *.tsx
    composite/
      NumberCircle.tsx
      NumberSquare.tsx
      MaterialBadge.tsx
      QuestionBadge.tsx
      _shared.ts                // shared sizing / state map for composite primitives
    index.ts                    // named re-exports
  components/
    ui/
      IconBtn.tsx               // the wrapper enforcing aria-label
      Tooltip.tsx               // never use native title=
```
