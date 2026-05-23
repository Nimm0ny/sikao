#!/usr/bin/env node
/**
 * lint-spacing-token.mjs — V5 task 5 (SIK-74) — Forbid hardcoded spacing values
 * on padding / margin / gap properties.
 *
 * V5 Correctness Property CP.1 (token single source) + REQ-4.5:
 *   apps/(*)/src/(*) must not hardcode `padding|margin|gap: <Npx|Nrem>`.
 *   All spacing MUST flow through `var(--space-1..8)` (V5 §1.2 primitive
 *   layer) or Tailwind className (`p-3` / `m-4` / `gap-5` etc., which
 *   resolve to V5 space tokens via tailwind.config).
 *
 * Detection scope:
 *   - CSS / SCSS files: `padding[-side]?: <Npx>` / `margin[-side]?: <Npx>` /
 *     `gap: <Npx>` / `row-gap: <Npx>` / `column-gap: <Npx>` literals.
 *   - JSX/TS inline-style objects: `padding[Top|Right|Bottom|Left]?: <Npx>` /
 *     `margin[Top|Right|Bottom|Left]?: <Npx>` / `gap: <Npx>` / `rowGap: <Npx>` /
 *     `columnGap: <Npx>` (camelCase form).
 *   - Tailwind arbitrary values: `p-[<v>]` / `px-[<v>]` / `m-[<v>]` /
 *     `mt-[<v>]` / `gap-[<v>]` / etc. with raw px/rem/em.
 *
 * Allowed values (no flag):
 *   - `0` / `auto` / `inherit` / `unset` / `initial` / `revert`
 *   - `var(--space-*)` or `var(--anything)` chain (defer to var sub-token check)
 *   - `calc(var(--space-*) ...)` chains
 *   - Tailwind className spacing (p-3, m-4, gap-5, px-6 etc., via lint-hardcode
 *     it tracks `[Npx]` arbitrary values; this lint catches inline-style + CSS)
 *
 * Exemptions:
 *   - Trailing or nearby (±5 lines) `// spacing-allow: <reason>`
 *   - Test directories (__tests__ / __mocks__)
 *
 * Run: `node apps/web/scripts/lint-spacing-token.mjs` (or `npm run lint:spacing`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts', '.css', '.scss'];

// CSS-form: padding / margin / gap / row-gap / column-gap with optional sides.
// Captures property name (group 1) and value list (group 2).
const CSS_SPACING_RE =
  /\b(padding(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|margin(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?|gap|row-gap|column-gap)\s*:\s*([^;\n}]+)/g;

// Inline style camelCase form: paddingTop / marginLeft / gap / rowGap / columnGap
// in JS/TS/JSX. Captures property (group 1) and raw value text (group 2).
const JS_SPACING_RE =
  /\b(padding(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|margin(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|gap|rowGap|columnGap)\s*:\s*(['"`]?[^,;\n}]+)/g;

// Tailwind arbitrary spacing: p-[12px] / px-[1rem] / m-[24px] / mt-[8px] /
// gap-[10px] / etc.
const TAILWIND_SPACING_RE =
  /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\[([^\]]+)\]/g;

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*spacing-allow:/;

const KEYWORD_RE = /^\s*(0|auto|inherit|unset|initial|revert)\s*$/i;
const VAR_OR_CALC_RE = /^\s*(var\(--[a-z0-9-]+\)|calc\([^)]*var\(--[a-z0-9-]+\)[^)]*\))\s*$/i;
// Hardcoded raw lengths: numeric px/rem/em/% (single token). Multi-token shorthands
// like "0 16px" / "var(--space-1) 8px" need per-token check.
const RAW_LENGTH_RE = /(?:^|\s)(-?\d+(?:\.\d+)?)(px|rem|em|%)\b/;

function valueIsHardcoded(value) {
  const trimmed = value.trim().replace(/[`'"]/g, '');
  if (KEYWORD_RE.test(trimmed)) return false;
  // Whole value pure var/calc: allowed.
  if (VAR_OR_CALC_RE.test(trimmed)) return false;
  // Tokenize space-separated parts; flag if any part is raw length AND not 0.
  const parts = trimmed.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (KEYWORD_RE.test(part)) continue;
    if (/^var\(--[a-z0-9-]+\)$/i.test(part)) continue;
    if (/^calc\(.*\)$/i.test(part)) continue;
    if (RAW_LENGTH_RE.test(' ' + part)) {
      const numMatch = part.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/i);
      if (numMatch && numMatch[1] === '0') continue;
      return true;
    }
  }
  return false;
}

function hasNearbyAllowComment(lines, lineNum) {
  const lo = Math.max(1, lineNum - 5);
  const hi = Math.min(lines.length, lineNum + 5);
  for (let i = lo; i <= hi; i++) {
    if (lines[i - 1] && ALLOW_RE.test(lines[i - 1])) return true;
  }
  return false;
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...listFiles(full));
    } else if (EXTS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const files = listFiles(ROOT);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const isCss = file.endsWith('.css') || file.endsWith('.scss');

  const propRe = isCss ? CSS_SPACING_RE : JS_SPACING_RE;

  for (const match of content.matchAll(propRe)) {
    const prop = match[1];
    const value = match[2] || '';
    if (!valueIsHardcoded(value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: isCss ? 'css-spacing-literal' : 'inline-spacing-literal',
      prop,
      snippet: value.trim().slice(0, 60),
    });
  }

  // Tailwind arbitrary spacing always scanned (regardless of file type).
  for (const match of content.matchAll(TAILWIND_SPACING_RE)) {
    const value = match[1].trim();
    if (/^var\(--[a-z0-9-]+\)$/i.test(value)) continue;
    if (KEYWORD_RE.test(value)) continue;
    if (!RAW_LENGTH_RE.test(' ' + value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'tailwind-spacing-arbitrary',
      prop: match[0].split('-[')[0],
      snippet: match[0],
    });
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} spacing-token violation(s) in ${files.length} files:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.prop}: ${v.snippet}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: replace literal padding/margin/gap with var(--space-1..8) or Tailwind p-3/m-4/gap-5 className.');
  console.error('Escape hatch: trailing `// spacing-allow: <reason>` on the same line.');
  process.exit(1);
}

console.log(`✓ spacing-token clean (${files.length} files scanned)`);
