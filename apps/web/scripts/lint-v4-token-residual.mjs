#!/usr/bin/env node
/**
 * lint-v4-token-residual.mjs — V5 task 8 (SIK-74) — V4 token regression guard.
 *
 * 2026-05-24 V5-M0.5 big-bang rebuild dropped the V1/V4 alias region from
 * tokens.css (commit 76c030e9b) AND the apps/web business layer + packages/ui
 * that consumed those names (commits 14ca2e971 + d37cc997c). At rebuild time
 * the repo had ZERO V4 token references in any retained surface.
 *
 * This lint is a regression guard: ensure new code does not re-introduce V4
 * token names. Per V5-M0.5 spec adjustment (tasks.md task 8), this lint runs
 * in error mode (no warn phase, no sunset countdown) — V4 names should never
 * appear again.
 *
 * Scanned scope:
 *   - apps/(*)/src/(*).{ts,tsx,css,scss}
 *   - packages/design-system/src/tokens.css (SSOT must stay V5-only)
 *
 * V4 names flagged (regex-anchored to avoid false positives on V5 names that
 * happen to share substrings, e.g. `--color-bg-page` is fine, but `--page-bg`
 * is V4):
 *   surface/text/border:
 *     --paper-1..3, --ink-1..4, --ink-3-soft, --line-1..3,
 *     --page-bg, --app-bg, --bg, --ok-bg, --warn-bg, --bad-bg
 *   brand/state/categorical (V4 names; V5 uses --color-brand-* / --color-state-*):
 *     --brand-yellow, --brand-yellow-hover, --brand-yellow-soft, --brand-1,
 *     --accent-1, --accent-2, --accent-50,
 *     --ok, --ok-50, --warn, --warn-50, --err, --err-50, --info, --info-50,
 *     --data-0..5
 *   shape/spacing/typography (V4 names):
 *     --r-1, --r-tiny, --r-2, --r-card, --r-card-lg, --r-app, --r-pill,
 *     --sp-1..9, --row-h, --topbar-h, --rail-w (--topbar-h/--rail-w retained
 *     in V5; not flagged), --h-xs, --h-sm, --h-md, --h-lg,
 *     --t-display, --t-h1..h3, --t-card, --t-body, --t-meta, --t-tiny,
 *     --fs-xs..5xl, --fs-h-card, --fs-h-section, --fs-h-mkt, --fs-display,
 *     --lh-tight, --lh-snug, --lh-normal, --lh-relaxed,
 *     --tracking-tight, --tracking-normal, --tracking-loose,
 *     --tracking-eyebrow, --tracking-wide, --tracking-wider, --tracking-widest
 *   misc V4 utilities:
 *     --font-serif, --font-sans, --font-mono (V4 family names; V5 uses inline
 *     system stack via apps/web/src/index.css), --shadow-card, --shadow-pop,
 *     --sidebar, --sidebar-fg, --sidebar-fg-muted, --sidebar-fg-dim,
 *     --sidebar-line, --sidebar-hover, --motion-fast, --motion-base,
 *     --motion-slow, --motion-ease, --row-y, --card-pad, --letter-radius,
 *     --read-fs, --read-lh, --icon-xs, --icon-sm, --icon-md, --icon-lg, --icon-xl
 *
 * Known V4 names PRESERVED in V5 (not flagged):
 *   --rail-w, --topbar-h (retained in V5 §4 component layer)
 *   --practice-reading-fs (V4 business feature, kept; consumed by domain/xingce)
 *
 * Escape hatch:
 *   - trailing or nearby (±5 lines) `// v4-residual-allow: <reason>`
 *   - file-level comment `v4-residual-allow-file: <reason>`
 *   - Skips __tests__ / __mocks__
 *
 * Run: `node apps/web/scripts/lint-v4-token-residual.mjs` (or `npm run lint:v4-residual`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';


const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..', '..', '..');
const SCAN_ROOTS = [
  join(REPO_ROOT, 'apps', 'web', 'src'),
  join(REPO_ROOT, 'packages', 'design-system', 'src'),
];
const EXTS = ['.tsx', '.ts', '.css', '.scss'];

// V4 token names enumerated explicitly. Single regex with alternation +
// boundary anchoring so that V5 names containing V4 substrings don't match
// (e.g. `--color-bg-page` must not flag the `bg` substring; `--page-bg`
// must flag).
//
// Strategy: each name is bounded by `--<name>` followed by a non-name char
// (right-anchor `(?!-?\w)`). Left side already starts with `--`.
const V4_NAMES = [
  // surface / text / border / app bg
  'paper-1', 'paper-2', 'paper-3',
  'ink-1', 'ink-2', 'ink-3', 'ink-4', 'ink-3-soft',
  'line-1', 'line-2', 'line-3',
  'page-bg', 'app-bg', 'bg',
  'ok-bg', 'warn-bg', 'bad-bg',
  // brand / state / data (V4)
  'brand-yellow', 'brand-yellow-hover', 'brand-yellow-soft', 'brand-1',
  'accent-1', 'accent-2', 'accent-50',
  'ok', 'ok-50', 'warn', 'warn-50', 'err', 'err-50', 'info', 'info-50',
  'data-0', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5',
  // shape (V4 r-* before V5 radius-*)
  'r-1', 'r-tiny', 'r-2', 'r-card', 'r-card-lg', 'r-app', 'r-pill',
  // spacing (V4 sp-* before V5 space-*)
  'sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5', 'sp-6', 'sp-7', 'sp-8', 'sp-9',
  // size (V4 row-h / h-* before V5 row-h-sm/md/lg + btn-h-*)
  'row-h',
  'h-xs', 'h-sm', 'h-md', 'h-lg',
  // typography (V4 t-* and fs-* before V5 font-*)
  't-display', 't-h1', 't-h2', 't-h3', 't-card', 't-body', 't-meta', 't-tiny',
  'fs-xs', 'fs-sm', 'fs-base', 'fs-md', 'fs-lg', 'fs-xl',
  'fs-2xl', 'fs-3xl', 'fs-4xl', 'fs-5xl',
  'fs-h-card', 'fs-h-section', 'fs-h-mkt', 'fs-display',
  'lh-tight', 'lh-snug', 'lh-normal', 'lh-relaxed',
  'tracking-tight', 'tracking-normal', 'tracking-loose',
  'tracking-eyebrow', 'tracking-wide', 'tracking-wider', 'tracking-widest',
  // V4 fonts / shadows / sidebar / motion / business utils
  'font-serif', 'font-sans', 'font-mono',
  'shadow-card', 'shadow-pop',
  'sidebar', 'sidebar-fg', 'sidebar-fg-muted', 'sidebar-fg-dim',
  'sidebar-line', 'sidebar-hover',
  'motion-fast', 'motion-base', 'motion-slow', 'motion-ease',
  'row-y', 'card-pad', 'letter-radius',
  'read-fs', 'read-lh',
  'icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl',
];

// Escape regex specials in token names. Only `-` and digits/letters in our
// list, but keep this defensive in case the list is extended.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const V4_RE = new RegExp(
  `--(${V4_NAMES.map(escapeRe).join('|')})(?![\\w-])`,
  'g',
);

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*v4-residual-allow:/;
const ALLOW_FILE_RE = /v4-residual-allow-file:/;

function listFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...listFiles(full));
    } else if (EXTS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function hasNearbyAllowComment(lines, lineNum) {
  const lo = Math.max(1, lineNum - 5);
  const hi = Math.min(lines.length, lineNum + 5);
  for (let i = lo; i <= hi; i++) {
    if (lines[i - 1] && ALLOW_RE.test(lines[i - 1])) return true;
  }
  return false;
}


const files = [];
for (const root of SCAN_ROOTS) files.push(...listFiles(root));

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(content)) continue;
  const lines = content.split('\n');

  for (const match of content.matchAll(V4_RE)) {
    const name = match[1];
    const idx = match.index;
    const lineNum = content.slice(0, idx).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      name: `--${name}`,
    });
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} V4 token residual(s) in ${files.length} files:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  ${v.name}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: V5-M0.5 big-bang (2026-05-24) dropped the V4 alias bridge.');
  console.error('Replace V4 token names with V5 equivalents (see V5 design.md §C.1-C.4 +');
  console.error('historical mapping in design.md §C.6 ARCHIVED for reference only).');
  console.error('Common rewrites:');
  console.error('  --paper-1  -> --color-bg-surface');
  console.error('  --ink-1    -> --color-text-primary');
  console.error('  --line-2   -> --color-border-default');
  console.error('  --accent-1 / --brand-yellow -> --color-brand-primary');
  console.error('  --ok / --warn / --err -> --color-state-ok / -warn / -err');
  console.error('  --r-card   -> --card-radius (or --radius-16 primitive)');
  console.error('  --sp-N     -> --space-N');
  console.error('  --t-body / --fs-base -> --font-body');
  console.error('Escape hatch: trailing `// v4-residual-allow: <reason>` or file-level');
  console.error('`/* v4-residual-allow-file: <reason> */` (use sparingly; flag for review).');
  process.exit(1);
}

console.log(`✓ V4 token residual clean (${files.length} files scanned, 0 V4 names found)`);
