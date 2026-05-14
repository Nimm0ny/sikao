---
type: design
status: active
owner: lhr
last-reviewed: 2026-05-09
---

# Composite Icons (复合编号 icon) — 详尽规范

> **The load-bearing piece** of the SIKAO icon system. These four primitives —
> `NumberCircle` · `NumberSquare` · `MaterialBadge` · `QuestionBadge` —
> render the dynamic "icon + 数字 + state" tokens that drive the answering
> experience. They appear hundreds of times per session and any inconsistency
> is immediately visible.
>
> Sister documents:
> - `SVG-ICON-DESIGN-SYSTEM.md` (visual language baseline)
> - `icon-inventory.html` (visual catalog with all states rendered)
> - `usage-rules.md` (call-site quick reference)

---

## 0. Why these are special

A regular icon (`StarIcon`, `PauseIcon`) is **static glyph + label**.
A composite icon is **glyph + dynamic data + state** rendered as a single
visual primitive. Think of it like an MS Office tab pinned to a Word document
that **shows page count + selection state in one breath**.

The difference matters:

| Regular icon | Composite icon |
|---|---|
| `<StarIcon />` | `<NumberCircle number={22} status="answered" />` |
| Reusable across surfaces | Bound to a specific spec section (FbDock / MmStrip / FbOpt) |
| Single visual variant | 4–5 status visuals, all in one file |
| Tree-shakable trivially | Tree-shakable, but always loaded (high traffic) |

Because the data lives **inside** the SVG (题号 22, 材料编号 M3, 字数 142/500),
they bend the "no text inside SVG" rule from `SVG-ICON-DESIGN-SYSTEM.md` §6.
This is by design — see §6.3 of the parent doc.

---

## A. NumberCircle — 题号圆

Used by: **FbDock 答题卡** (35 题号) · **FbOpt** (A/B/C/D 选项 letter) ·
**FbGroupTabs** (Q12 Q13 Q14 Q15) · **WrongBook list 题号 chip**.

### A.1 Visual baseline

| Property | Value |
|---|---|
| `viewBox` | `0 0 24 24` |
| Outer circle | `<circle cx="12" cy="12" r="11" />` (1px inset for crispness; r=11 prevents stroke clip at viewBox edge) |
| Stroke width | `1.4` |
| Number font | `var(--mono)` `JetBrains Mono` with `font-variant-numeric: tabular-nums` |
| Number x | `12` (centered) |
| Number y | `16` (baseline-adjusted; `text-anchor="middle" dominant-baseline="central"` is fragile cross-browser; we hand-tune `y` per font size) |
| Number size | 11 (single digit 1-9 / letter A-D) / 10 (double digit 10-99) / 9 (triple digit 100+, rare) |

### A.2 Five canonical states (per spec 03-xingce.md §关键交互)

> Spec quote: "圆点 = 未答 / 实心 = 已答 / 描边 = 标记 / blue accent = 当前题"

| State | Outer stroke | Outer fill | Number color | Use |
|---|---|---|---|---|
| `unanswered` | `var(--ink-3)` (subdued) | `none` | `var(--ink-3)` | 未答的题号 |
| `answered` | `none` | `var(--ink)` | `var(--paper)` | 已答（实心黑） |
| `marked` | `var(--accent)` `1.4` | `none` | `var(--accent)` | 已标记（蓝色描边） |
| `current` | `var(--accent)` | `var(--accent)` | `var(--paper)` | 当前题（蓝色实心） |
| `wrong` (审查后) | `none` | `var(--bad-bg)` | `var(--bad)` | 提交后展示用 |

A 6th implicit state is `correct` — but in xingce results we use the **green check
overlay** pattern instead of recoloring the circle (see §A.7). Correct does not
stand alone as a `NumberCircle` status.

### A.3 SVG (each state)

```svg
<!-- unanswered -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     style="color: var(--ink-3)">
  <circle cx="12" cy="12" r="11" stroke-width="1.4"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="currentColor" font-variant-numeric="tabular-nums">22</text>
</svg>

<!-- answered (filled ink) -->
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="11" fill="var(--ink)"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="var(--paper)" font-variant-numeric="tabular-nums">22</text>
</svg>

<!-- marked (outline accent) -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     style="color: var(--accent)">
  <circle cx="12" cy="12" r="11" stroke-width="1.4"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="currentColor" font-variant-numeric="tabular-nums">22</text>
</svg>

<!-- current (filled accent) -->
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="11" fill="var(--accent)"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="var(--paper)" font-variant-numeric="tabular-nums">22</text>
</svg>

<!-- wrong (review state) -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     style="color: var(--bad)">
  <circle cx="12" cy="12" r="11" fill="var(--bad-bg)"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="currentColor" font-variant-numeric="tabular-nums">22</text>
</svg>
```

> **Why two style channels** (`style="color: ..."` for stroked states, hard-coded
> `var(--...)` for filled states): SVG `currentColor` only affects `stroke`/`fill`
> attributes set to `currentColor`. For mixed states (outer stroke X + inner fill Y),
> we use explicit token vars per attribute. This is the **only** place in the icon
> system where `var(--token)` appears inside SVG — and it's because `currentColor`
> can carry only one value at a time.

### A.4 React contract

```tsx
// frontend/src/icons/composite/NumberCircle.tsx
type NumberCircleStatus = 'unanswered' | 'answered' | 'marked' | 'current' | 'wrong';

interface NumberCircleProps {
  number: number | string;        // 1-50 or 'A'/'B'/'C'/'D'
  status: NumberCircleStatus;
  size?: 'sm' | 'md' | 'lg';      // 24 / 28 / 32 outer
  ariaLabel: string;              // "第 22 题, 已答, 点击跳转"
  onClick?: () => void;
  current?: boolean;              // shorthand for status="current" + halo
}

const STATUS_COLORS: Record<NumberCircleStatus, {
  outerStroke: string | 'none';
  outerFill: string | 'none';
  numberColor: string;
}> = {
  unanswered: { outerStroke: 'var(--ink-3)', outerFill: 'none', numberColor: 'var(--ink-3)' },
  answered:   { outerStroke: 'none', outerFill: 'var(--ink)', numberColor: 'var(--paper)' },
  marked:     { outerStroke: 'var(--accent)', outerFill: 'none', numberColor: 'var(--accent)' },
  current:    { outerStroke: 'none', outerFill: 'var(--accent)', numberColor: 'var(--paper)' },
  wrong:      { outerStroke: 'none', outerFill: 'var(--bad-bg)', numberColor: 'var(--bad)' },
};

const SIZE_PX = { sm: 24, md: 28, lg: 32 } as const;
const FONT_SIZE_FOR_NUM = (n: string | number, outer: number) => {
  const txt = String(n);
  if (txt.length === 1) return outer * 0.46;       // 24 → 11; 28 → ~13; 32 → ~15
  if (txt.length === 2) return outer * 0.42;       // 24 → 10
  return outer * 0.38;
};
```

The component renders either a button (clickable) or a span (display-only).
Clickable variant adds `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.

### A.5 Sizing pattern across surfaces

| Surface | Size | Why |
|---|---|---|
| FbDock 答题卡（屏底悬浮） | `sm` (24) | Dense — 35 in a row |
| FbOpt 选项 letter | `md` (28) | Easier touch target — only 4 per question |
| FbGroupTabs 题组 (Q12 Q13 Q14 Q15) | `md` (28) | Same |
| WrongBook list 行内题号 | `sm` (24) | Inline within a row |
| Result page 题号 grid (35 个) | `lg` (32) | Spread out, large readable |

### A.6 Halo (current state extra emphasis)

When `status="current"` and the surface is FbDock, render an additional 2px
expanded halo:

```svg
<circle cx="12" cy="12" r="11.5" stroke="var(--accent)" stroke-width="0.6" stroke-opacity="0.3" fill="none"/>
```

This is 1 ring outside the filled accent circle; emphasizes "you are here" without
shifting layout. **Only enabled in FbDock context** via `current` prop, not as
a separate status.

### A.7 Compositing wrong + correct (results page)

For the result page where every 题号 needs a verdict, use the wrong NumberCircle
PLUS a small decorator, NOT a recolored variant. This keeps the primitive with 5
clean states.

```tsx
<div className="number-cell">
  <NumberCircle number={n} status={isWrong ? 'wrong' : 'unanswered'} />
  {isCorrect && <StatusDoneIcon size="xs" className="cell-decorator" />}
  {isWrong && <StatusWrongIcon size="xs" className="cell-decorator" />}
</div>
```

CSS positions the decorator at top-right corner (`absolute right: -2px; top: -2px`).

---

## B. NumberSquare — 方形版

**Identical** to `NumberCircle` semantically. Shape changes via the
`Tweaks` panel toggle: `option-style="square"` (per SIKAO handoff CLAUDE.md §Tweak
协议: 切换 option 样式 fenbi 圆形 / 方形 letter).

### B.1 Visual difference

| Property | NumberCircle | NumberSquare |
|---|---|---|
| Outer shape | `<circle cx="12" cy="12" r="11">` | `<rect x="1" y="1" width="22" height="22" rx="4">` |
| Border radius | n/a | `var(--r-sm)` (4px) — uniform across all square states |
| All other rules | (per A.x) | identical |

### B.2 SVG (one example state — `current`)

```svg
<svg viewBox="0 0 24 24" fill="none">
  <rect x="1" y="1" width="22" height="22" rx="4" fill="var(--accent)"/>
  <text x="12" y="16" text-anchor="middle"
        font-family="var(--mono)" font-size="11"
        fill="var(--paper)" font-variant-numeric="tabular-nums">B</text>
</svg>
```

### B.3 Implementation

`NumberSquare.tsx` shares the status map and font-sizing fn with `NumberCircle.tsx`
via `composite/_shared.ts`:

```ts
// frontend/src/icons/composite/_shared.ts
export const STATUS_COLORS = { /* ...same map as A.4... */ };
export const SIZE_PX = { sm: 24, md: 28, lg: 32 } as const;
export function fontSizeForNumber(n: string | number, outer: number): number {
  const txt = String(n);
  if (txt.length === 1) return outer * 0.46;
  if (txt.length === 2) return outer * 0.42;
  return outer * 0.38;
}
```

Both files are **3 numbered states** thick (`unanswered/marked/current` all
stroke-only) plus **2 fill states** (`answered/wrong`). Total component LOC ~80
each — small enough that we keep them separate per SIKAO file-per-icon rule.

### B.4 When to use each

- **Default** = `NumberCircle` (matches fenbi style — "圆形 letter 动效").
- **Square** opt-in = via `data-option-style="square"` on the practice grid; cuts
  visual noise when 35 题号 cluster (some testers prefer square density).
- **Decision is per-user-preference** via Tweaks; not per-design-decision.

---

## C. MaterialBadge — 申论材料编号 M1 ... M9

> Spec ref: `04-essay.md` §04b · 多材料多题目 / `essay-mm-strip` `.l`
>
> "M1 [2 处] ●  | M2 已读 | M3 已读 | M4 1 处 ● | M5 已读 | M6 未读 | M7 未读"

### C.1 Why a single primitive (not a chip + sub-icons)

The MmStrip layout is `grid-template-columns: repeat(7, 1fr)` — every cell is the
**same width**. This means the M-badge must render its own shell (rect background)
PLUS title PLUS sub-meta PLUS optional dot — all bound to a fixed column slot,
overflow-clipped, never wrapping. A primitive is cleaner than 4 separate components
that always co-occur.

### C.2 Visual structure

```
┌────────────────────────┐
│  M1            ●       │  ← title (mono 11 / letter-spaced) + status dot
│  2 处                  │  ← sub-meta (mono 9 / muted)
└────────────────────────┘
   rect 36×24-ish (responsive within grid)
   border-radius: var(--r-sm) (4)
```

Implementation uses **`<svg viewBox>` aware of dynamic width** + foreign-object-free
text. Or — for stripping engineering complexity — render as `<button>` containing
HTML+CSS, with **only the dot** as inline SVG. We choose the latter:

> **Decision**: `MaterialBadge` is rendered as **HTML + 1 inline `<svg>` for the dot**,
> NOT as a single SVG. This is consistent with what's possible inside a CSS
> `grid-template-columns: repeat(7, 1fr)` cell, and it sidesteps the SVG-text
> alignment cross-browser pain. The container remains an `<button>` for clickability
> + `aria-label`.

### C.3 Four states (per spec 04-essay.md MmStrip)

| State | rect border | rect background | text color | dot | Use |
|---|---|---|---|---|---|
| `pending` (未读) | `1px solid var(--rule)` | `none` | `var(--ink-3)` | absent | 还没看过 |
| `read` (已读) | `1px solid var(--rule)` | `var(--paper-2)` | `var(--ink-2)` | absent | 已浏览 |
| `marked` (有划重点) | `1px solid var(--accent)` | `var(--accent-50)` | `var(--accent-2)` | small `var(--accent)` filled circle | 内有划线/clip |
| `active` (当前) | `1px solid var(--accent)` | `none` | `var(--accent)` | absent (different visual cue: bottom underline 2px accent) | 正在阅读这条 |

### C.4 Sub-meta line

| Status | Sub-meta text |
|---|---|
| `pending` | `未读` |
| `read` | `已读` |
| `marked` (with count) | `N 处` (the count prop) |
| `marked` (no count, but flagged) | `已读` (count omitted, dot shown) |
| `active` | `已读` or empty (whatever the underlying read state is) |

### C.5 HTML + CSS

```html
<button
  class="mat-badge"
  data-status="marked"
  aria-label="材料 1, 已读, 内有 2 处划重点"
>
  <span class="title">M1<span class="dot" aria-hidden="true"><svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="var(--accent)"/></svg></span></span>
  <span class="meta">2 处</span>
</button>
```

```css
.mat-badge {
  display: grid;
  grid-template-rows: auto auto;
  align-content: center;
  padding: 6px 10px;
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  background: transparent;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  font-family: var(--mono);
  color: var(--ink-3);
}
.mat-badge .title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}
.mat-badge .meta {
  font-size: 9px;
  color: var(--ink-4);
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mat-badge .dot svg { width: 8px; height: 8px; display: block; }

/* States */
.mat-badge[data-status="pending"] { border-color: var(--rule); color: var(--ink-3); }
.mat-badge[data-status="read"]    { background: var(--paper-2); color: var(--ink-2); }
.mat-badge[data-status="marked"]  {
  border-color: var(--accent);
  background: var(--accent-50);
  color: var(--accent-2);
}
.mat-badge[data-status="active"]  {
  border-color: var(--accent);
  color: var(--accent);
  position: relative;
}
.mat-badge[data-status="active"]::after {
  content: '';
  position: absolute;
  left: 10%; right: 10%; bottom: -3px;
  height: 2px;
  background: var(--accent);
}

/* Marked dot only shown for marked state — handled by hiding via CSS in other states */
.mat-badge:not([data-status="marked"]) .dot { display: none; }

.mat-badge:hover { background: var(--paper-2); }
.mat-badge[data-status="marked"]:hover { background: var(--accent-50); }
.mat-badge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### C.6 React contract

```tsx
// frontend/src/icons/composite/MaterialBadge.tsx
type MaterialBadgeStatus = 'pending' | 'read' | 'marked' | 'active';

interface MaterialBadgeProps {
  index: number;                           // 1, 2, 3, ...
  status: MaterialBadgeStatus;
  count?: number;                          // marked count: "2 处" — only shown when status === 'marked'
  onClick?: () => void;
  ariaLabel: string;                       // mandatory
}

export function MaterialBadge({ index, status, count, onClick, ariaLabel }: MaterialBadgeProps) {
  const meta = (() => {
    if (status === 'marked' && count !== undefined) return `${count} 处`;
    if (status === 'pending') return '未读';
    return '已读';
  })();

  return (
    <button
      type="button"
      className="mat-badge"
      data-status={status}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="title">
        {`M${index}`}
        {status === 'marked' && (
          <span className="dot" aria-hidden="true">
            <svg viewBox="0 0 8 8" width="8" height="8">
              <circle cx="4" cy="4" r="3" fill="var(--accent)" />
            </svg>
          </span>
        )}
      </span>
      <span className="meta">{meta}</span>
    </button>
  );
}
```

### C.7 ARIA label patterns

| Status | Label template |
|---|---|
| `pending` | `材料 {index}, 未读` |
| `read` | `材料 {index}, 已读` |
| `marked` (with count) | `材料 {index}, 已读, 内有 {count} 处划重点` |
| `active` | `材料 {index}, 当前正在阅读` |

ARIA labels MUST be mandatory at TS level (the prop is `required`). CI check
verifies no `MaterialBadge` is missing `ariaLabel`.

### C.8 Dimensions in MmStrip

The MmStrip cell is responsive — `repeat(7, 1fr)` on a parent that's typically
560–680px wide → each cell ~80–96px. The badge fills the cell, height auto from
content. Recommended max-width 110px (gracefully degrades for smaller viewports
where the strip wraps below 560px — see spec for that fallback).

---

## D. QuestionBadge — 申论问题编号 Q1 ... Q4

> Spec ref: `04-essay.md` §04b · 多材料多题目 / `essay-mm-strip` `.r`
>
> "Q1 198/200 ✓ | Q2 312/300 ✓ | Q3 142/500 (active) | Q4 0/1000 (locked)"

Sister to `MaterialBadge` but tracking word-count progress instead of read-count.

### D.1 Four states

| State | rect border | rect bg | title color | sub-meta | extras |
|---|---|---|---|---|---|
| `locked` | `1px solid var(--rule)` | `none` | `var(--ink-4)` | `0/N`(grey) | small lock icon (`StatusLockedIcon`) inline before "Q4" |
| `pending` | `1px solid var(--rule)` | `none` | `var(--ink-3)` | `0/N` | none |
| `writing` | `1px solid var(--accent)` | `none` | `var(--accent)` | `M/N` (bold mono) | letter underline 2px accent |
| `submitted` | `1px solid var(--ok)` | `var(--ok-bg)` | `var(--ok)` | `M/N ✓` | inline check (StatusDoneIcon size xs) |

### D.2 HTML + CSS

```html
<!-- writing -->
<button class="q-badge" data-status="writing" aria-label="问题 3, 正在作答, 142 字 共 500 字">
  <span class="title">Q3</span>
  <span class="meta">142/500</span>
</button>

<!-- submitted -->
<button class="q-badge" data-status="submitted" aria-label="问题 1, 已提交, 198 字 共 200 字">
  <span class="title">Q1</span>
  <span class="meta">
    198/200
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
      <path d="M2 8l3 3 8-8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </span>
</button>

<!-- locked -->
<button class="q-badge" data-status="locked" aria-label="问题 4, 未解锁">
  <span class="title">
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke-linecap="round"/>
    </svg>
    Q4
  </span>
  <span class="meta">0/1000</span>
</button>
```

```css
.q-badge {
  display: grid;
  grid-template-rows: auto auto;
  padding: 6px 10px;
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  background: transparent;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
  transition: all 120ms ease;
  font-family: var(--mono);
  color: var(--ink-3);
}
.q-badge .title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}
.q-badge .meta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: var(--ink-4);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-badge[data-status="locked"]    { color: var(--ink-4); pointer-events: none; }
.q-badge[data-status="pending"]   { color: var(--ink-3); }
.q-badge[data-status="writing"]   {
  border-color: var(--accent);
  color: var(--accent);
}
.q-badge[data-status="writing"] .title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  text-decoration-color: var(--accent);
}
.q-badge[data-status="writing"] .meta {
  color: var(--accent);
  font-weight: 500;
}
.q-badge[data-status="submitted"] {
  border-color: var(--ok);
  background: var(--ok-bg);
  color: var(--ok);
}
.q-badge[data-status="submitted"] .meta {
  color: var(--ok);
}

.q-badge:hover { background: var(--paper-2); }
.q-badge[data-status="writing"]:hover { background: var(--paper-2); }
.q-badge[data-status="submitted"]:hover { background: var(--ok-bg); filter: brightness(0.98); }
.q-badge:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### D.3 React contract

```tsx
type QuestionBadgeStatus = 'locked' | 'pending' | 'writing' | 'submitted';

interface QuestionBadgeProps {
  index: number;                       // 1, 2, 3, 4
  status: QuestionBadgeStatus;
  current?: number;                    // word count current
  required?: number;                   // word count target
  onClick?: () => void;
  ariaLabel: string;
}
```

ARIA label templates:

| Status | Template |
|---|---|
| `locked` | `问题 {index}, 未解锁` |
| `pending` | `问题 {index}, 待作答` |
| `writing` | `问题 {index}, 正在作答, {current} 字 共 {required} 字` |
| `submitted` | `问题 {index}, 已提交, {current} 字 共 {required} 字` |

### D.4 Edge case: word count exceeds requirement

When `current > required` (e.g. `312/300`), display as-is (the over-count is
information). No extra styling — the ✓ indicator handles "submitted" cleanly.

### D.5 Edge case: word count required = 0 (open-ended)

Some essay questions have no word minimum — display `M 字` instead of `M/0`:

```tsx
const meta = required > 0 ? `${current}/${required}` : `${current} 字`;
```

---

## E. Cross-cutting rules

These apply to ALL composite icons (A/B/C/D):

### E.1 Determinism

- Same props → same DOM output. No randomness, no `Math.random()`, no time-based
  rendering. Critical for testability.
- Number content goes via React props, never hardcoded inside the SVG path.

### E.2 No ASCII glyphs as separators inside the badge

- ❌ `<span class="meta">198/200 ✓</span>` — use a real `<svg>` for the check.
- ❌ "Q1 198/200" with text "✓" — same.
- ✅ The slash `/` between `M/N` is allowed (it's a numeric separator, not a glyph).

### E.3 Token discipline

- All shape colors / text colors / borders / radii flow through `var(--*)` token.
- `border-radius: var(--r-sm)` — never `4px` literal.
- Padding may use literal pixels (`6px 10px`) since that's a layout choice not a
  brand token; if you need theme-tunable padding, add `--badge-pad` to tokens.css.
- Gap between title and meta in vertical stack is implicit (grid auto rows + line-height) — keep it that way; do not add explicit `gap`.

### E.4 Dark-mode behavior

In `[data-theme="night"]`, `--accent` keeps the ink-first accent role while the
surface tokens shift dark. The badges work because all references are tokens.

Text readability for `marked` state must be re-verified when `--accent-50`
changes in night mode.

### E.5 Tests

For each composite icon, the test suite must cover:

1. **Each status renders the documented visual stack** — DOM assertions on
   `data-status` attribute, key CSS class presence.
2. **ariaLabel is forwarded to the button** — `getByLabelText` lookup.
3. **onClick handler fires** for clickable variants.
4. **Number / count / wordCount contents** display correctly.
5. **Default rendering** (without optional props) for `pending` / `unanswered`
   states.

Per the SIKAO testing convention (memory `feedback_view_tests_three_states`):
each composite icon test file covers `loading | empty | error` analogues by
substituting status combinations.

### E.6 Composition with regular icons

Composite icons CAN be composed with regular icons. Example seen in the inventory:

- `QuestionBadge[locked]` shows `StatusLockedIcon` (size xs) inside its title row
- `QuestionBadge[submitted]` shows `StatusDoneIcon` (size xs, inline 11px)
  inside its meta row

When this happens:
- The decoration icon is `aria-hidden="true"` (the badge ariaLabel covers semantics).
- Sizing is xs (10–11px) so it doesn't fight the mono numerals.
- Color inherits from the parent (`color: var(--accent)` etc) via `currentColor`.

### E.7 Performance

- Each composite icon component is < 100 LOC. No inline `useMemo`. No Suspense.
- The status-color map is module-level (not per-render).
- `MaterialBadge` and `QuestionBadge` use HTML + minimal SVG (only for dot/check)
  to avoid SVG `<text>` x/y micro-placement issues.

---

## F. Implementation backlog (informational)

These are the tasks the icon-implementation phase will pick up. Listed here so
spec stays single-source.

1. `NumberCircle` — 5 states × 3 sizes = 15 storybook variants; visual diff vs
   spec 03-xingce HTML's `.fb-dock .ic-btn` reference.
2. `NumberSquare` — same matrix; verify Tweaks toggle works.
3. `MaterialBadge` — 4 states; integration test with MmStrip `repeat(7, 1fr)` grid.
4. `QuestionBadge` — 4 states; verify word-count overflow (`312/300`) renders.
5. Lint rule `lint:icon-tokens` — implementation in `frontend/scripts/`.
6. Storybook MDX page `composite-icons.stories.mdx` — every state visualised
   side-by-side with spec citations.

---

## G. Worked example — full FbDock 35 题号 with mixed states

This is the canonical test case. The dock should contain a mix of all 5 states
and the `current` halo, exhibiting reading rhythm even in worst case.

```tsx
<div className="fb-dock-grid" role="list" aria-label="答题卡, 共 35 题">
  {Array.from({ length: 35 }, (_, i) => {
    const n = i + 1;
    const status = computeStatus(n);   // returns one of 5
    return (
      <NumberCircle
        key={n}
        number={n}
        status={status}
        ariaLabel={`第 ${n} 题, ${labelFor(status)}, 点击跳转`}
        onClick={() => goto(n)}
      />
    );
  })}
</div>
```

```css
.fb-dock-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);   /* 5 rows × 7 cols = 35 */
  gap: 6px;
  padding: 12px 16px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
}
```

This pattern repeats verbatim in the inventory HTML (§Composite section).
