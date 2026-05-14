# SIKAO Global Styles Reference

> Status: archived/source-only. This extracted file records an older HTML prototype
> and must not be treated as active design-token SSOT. Current active direction is
> ink-first with blue accent; see `docs/design/style-guide.md`.

## Source
- File: SIKAO Redesign.html lines 11-1050
- CSS custom properties (tokens): lines 18-97
- Base + utilities: lines 99-300

## Design Tokens (CSS Variables)

### Color Palette

\\\css
:root {
  /* paper / ink — warm neutrals */
  --paper:        #FAF7F0;   /* main bg, warm cream */
  --paper-2:      #F4F0E6;   /* card alt / hover */
  --paper-3:      #ECE6D7;   /* muted block */
  --rule:         #E2DBC8;   /* hairline */
  --rule-strong:  #C9C0A8;
  --ink:          #1A1815;   /* near-black, warm */
  --ink-2:        #3A352D;   /* secondary text */
  --ink-3:        #6B6358;   /* tertiary / caption */
  --ink-4:        #948A7A;   /* placeholder / muted icon */

  /* accent · blue (active direction: ink-first + blue accent) */
  --accent:       #3F7EF1;
  --accent-2:     #1F4FD8;
  --accent-50:    #E7EDFD;

  /* semantic */
  --ok:           #4A6B3A;
  --ok-bg:        #E7E9D9;
  --warn:         #A66A18;
  --warn-bg:      #F4E5C8;
  --err:          #8B2F2F;
  --err-bg:       #F1DCD7;
}
\\\

### Typography

\\\css
:root {
  --serif:  'Source Serif 4', 'Noto Serif SC', Georgia, serif;
  --sans:   'Inter', system-ui, 'PingFang SC', sans-serif;
  --mono:   'JetBrains Mono', 'SF Mono', Menlo, monospace;

  --t-display: 72px;
  --t-h1:      44px;
  --t-h2:      30px;
  --t-h3:      22px;
  --t-h4:      18px;
  --t-body:    15px;
  --t-sm:      13px;
  --t-cap:     12px;
  --t-eyebrow: 11px;
}
\\\

### Spacing Scale

\\\css
:root {
  --s1: 4px;  --s2: 8px;  --s3: 12px;  --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px; --s8: 72px;
}
\\\

### Border Radius

\\\css
:root {
  --r-sm: 4px;   /* chip, small interactive */
  --r-md: 6px;   /* button, card */
  --r-lg: 10px;  /* dock, drawer */
  --r-xl: 14px;  /* large hover states */
}
\\\

### Shadow

\\\css
:root {
  --shadow-1: 0 1px 0 rgba(26,24,21,.04), 0 1px 2px rgba(26,24,21,.04);
  --shadow-2: 0 6px 24px -8px rgba(26,24,21,.16), 0 2px 6px rgba(26,24,21,.05);
  --shadow-3: 0 24px 48px -16px rgba(26,24,21,.22);
}
\\\

## Theme Overrides

### Pure Theme (素白)

\\\css
[data-theme="pure"] {
  --paper:#FFFFFF;
  --paper-2:#F7F7F8;
  --paper-3:#EFEFF1;
  --rule:#E5E5E8;
  --rule-strong:#CFCFD3;
  --ink:#0A0A0B;
  --ink-2:#2D2D31;
  --ink-3:#5C5C63;
  --ink-4:#8A8A92;
  --accent:#1F4FD8;
  --accent-2:#1839A0;
  --accent-50:#E7EDFD;
}
\\\

### Night Theme (夜读)

\\\css
[data-theme="night"] {
  --paper:#1B1814;
  --paper-2:#231F1A;
  --paper-3:#2D2823;
  --rule:#3A332C;
  --rule-strong:#544A3F;
  --ink:#F2EAD8;
  --ink-2:#D6CDB8;
  --ink-3:#9B917D;
  --ink-4:#6E6657;
  --accent:#D9A055;
  --accent-2:#B07F36;
  --accent-50:#3A2E1C;
  --ok:#9DB37C;
  --ok-bg:#2A2E1F;
  --warn:#D9A055;
  --warn-bg:#3A2E1C;
  --err:#D67264;
  --err-bg:#3A1E1A;
}
\\\

## Density & Reading Size Switches

\\\css
[data-density="cozy"]   { --pad-card: 28px; --gap-card: 18px; }
[data-density="compact"]{ --pad-card: 20px; --gap-card: 12px; }
:root { --pad-card: 24px; --gap-card: 16px; }

[data-reading="lg"] { --t-body:16px; --t-sm:14px; }
[data-reading="xl"] { --t-body:17px; --t-sm:15px; }
\\\

## Base Reset

\\\css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: var(--t-body);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
em, i { font-style: normal; }
b, strong { font-weight: 600; }
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; }
\\\

## Utility Classes

### Typography Utilities

\\\css
.serif {
  font-family: var(--serif);
  font-feature-settings: "ss01","onum";
  letter-spacing: -0.01em;
}

.sans {
  font-family: var(--sans);
}

.mono {
  font-family: var(--mono);
  font-feature-settings: "tnum";
}

.eyebrow {
  font-family: var(--mono);
  font-size: var(--t-eyebrow);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-3);
}
\\\

## Focus Styles

\\\css
button:focus-visible, a:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
\\\

## Scrollbar Styling

\\\css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--paper-2);
}

::-webkit-scrollbar-thumb {
  background: var(--rule-strong);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--ink-3);
}
\\\

## Print Styles

\\\css
@media print {
  body { background: white; color: black; }
  .no-print { display: none; }
}
\\\

---

## Notes for Implementation

1. All color, spacing, and typography should use CSS variables exclusively
2. Never hardcode hex values in component files
3. Font feature settings (ss01=stylistic set, onum=oldstyle numerals, tnum=tabular numerals)
4. Tokens in this file are the SSOT; design/tokens.css in React should mirror these
5. Emotion/Tailwind should be configured to exclude default reset and use these tokens
