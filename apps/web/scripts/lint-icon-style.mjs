#!/usr/bin/env node
/**
 * lint-icon-style.mjs — V5 task 6 (SIK-74) — Enforce SVG icon style invariants.
 *
 * V5 Correctness Property CP.5 (SVG-only icon invariant) + REQ-1.1 / REQ-8.6:
 *   icon SVGs in packages/design-system/src/icons/* (V5-M4 sprite landing
 *   site) and apps/**∕*.svg (sprite consumers + business icons) MUST follow
 *   a uniform stroke-style contract:
 *     - viewBox="0 0 24 24" (single canonical canvas)
 *     - fill="none" (stroke-only icon by default)
 *     - stroke="currentColor" (themeable via CSS color)
 *     - stroke-linecap="round" + stroke-linejoin="round"
 *     - stroke-width ∈ {1.5, 1.6, 1.7, 1.8, 2.0} per V5 §C.5.1 size ladder
 *
 * Filled-variant exemption:
 *   files matching *Filled.svg / *-filled.svg / *.filled.svg are scanned but
 *   stroke checks are skipped; fill MUST be "currentColor" instead of literal
 *   hex (so the filled glyph still themes correctly).
 *
 * Brand / social / favicon exemption (path-based):
 *   apps/web/public/favicon.svg  — sikao logo
 *   apps/web/public/og-image.svg — OG share image (not a UI icon)
 *   apps/web/public/icons.svg    — V4 social/oauth sprite (replaced by V5-M4)
 *   File-level escape hatch: comment containing `icon-style-allow-file: <reason>`
 *
 * Run: `node apps/web/scripts/lint-icon-style.mjs` (or `npm run lint:icon-style`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..', '..', '..');
const SCAN_ROOTS = [
  join(REPO_ROOT, 'packages', 'design-system', 'src'),
  join(REPO_ROOT, 'apps', 'web', 'src'),
];

// Path-based exemptions (relative to repo root, forward-slash form).
const PATH_EXEMPT_RE = [
  /\/apps\/web\/public\/favicon\.svg$/,
  /\/apps\/web\/public\/og-image\.svg$/,
  /\/apps\/web\/public\/icons\.svg$/,
];

const FILLED_RE = /(?:Filled|-filled|\.filled)\.svg$/i;
const ALLOW_FILE_RE = /icon-style-allow-file:/;

const ALLOWED_STROKE_WIDTHS = new Set(['1.5', '1.6', '1.7', '1.8', '2', '2.0']);

function listSvgFiles(dir) {
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
      out.push(...listSvgFiles(full));
    } else if (full.endsWith('.svg')) {
      out.push(full);
    }
  }
  return out;
}

function pathPosix(p) {
  return p.replace(/\\/g, '/');
}

function isExempt(file) {
  const posix = '/' + pathPosix(relative(REPO_ROOT, file));
  return PATH_EXEMPT_RE.some((re) => re.test(posix));
}

function attrValue(rootEl, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`);
  const match = rootEl.match(re);
  return match ? match[1] : null;
}

function attrValuesAll(content, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'g');
  return [...content.matchAll(re)].map((m) => m[1]);
}

const files = [];
for (const root of SCAN_ROOTS) files.push(...listSvgFiles(root));

const violations = [];

for (const file of files) {
  if (isExempt(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(content)) continue;

  const rootMatch = content.match(/<svg\b([^>]*)>/i);
  const rootAttrs = rootMatch ? rootMatch[1] : '';

  const isFilled = FILLED_RE.test(file);

  const viewBox = attrValue(`<svg ${rootAttrs}>`, 'viewBox');
  if (viewBox !== '0 0 24 24') {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `viewBox is ${viewBox === null ? 'missing' : `"${viewBox}"`}, must be "0 0 24 24"`,
    });
  }

  if (isFilled) {
    // Filled variant: fill must be currentColor; stroke checks skipped.
    const fills = attrValuesAll(content, 'fill').filter((v) => v !== 'none');
    const allCurrent = fills.every((v) => v === 'currentColor');
    if (!allCurrent) {
      const offenders = fills.filter((v) => v !== 'currentColor').slice(0, 3);
      violations.push({
        file: pathPosix(relative(process.cwd(), file)),
        reason: `filled variant must use fill="currentColor" (got: ${offenders.join(', ')})`,
      });
    }
    continue;
  }

  // Stroke-only contract.
  const fill = attrValue(`<svg ${rootAttrs}>`, 'fill');
  if (fill !== 'none') {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `<svg> fill must be "none" (got: ${fill === null ? 'missing' : `"${fill}"`})`,
    });
  }
  const stroke = attrValue(`<svg ${rootAttrs}>`, 'stroke');
  if (stroke !== 'currentColor') {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `<svg> stroke must be "currentColor" (got: ${stroke === null ? 'missing' : `"${stroke}"`})`,
    });
  }
  const linecap = attrValue(`<svg ${rootAttrs}>`, 'stroke-linecap');
  if (linecap !== 'round') {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `<svg> stroke-linecap must be "round" (got: ${linecap === null ? 'missing' : `"${linecap}"`})`,
    });
  }
  const linejoin = attrValue(`<svg ${rootAttrs}>`, 'stroke-linejoin');
  if (linejoin !== 'round') {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `<svg> stroke-linejoin must be "round" (got: ${linejoin === null ? 'missing' : `"${linejoin}"`})`,
    });
  }
  const strokeWidth = attrValue(`<svg ${rootAttrs}>`, 'stroke-width');
  if (strokeWidth === null || !ALLOWED_STROKE_WIDTHS.has(strokeWidth)) {
    violations.push({
      file: pathPosix(relative(process.cwd(), file)),
      reason: `<svg> stroke-width must be in {1.5,1.6,1.7,1.8,2.0} (got: ${strokeWidth ?? 'missing'})`,
    });
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} icon-style violation(s) in ${files.length} svg file(s):\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}\n    → ${v.reason}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: ensure root <svg> has viewBox="0 0 24 24" + fill="none" + stroke="currentColor" + stroke-linecap="round" + stroke-linejoin="round" + stroke-width in {1.5,1.6,1.7,1.8,2.0}.');
  console.error('Filled variants (*Filled.svg / *-filled.svg / *.filled.svg) only need viewBox + fill="currentColor".');
  console.error('Escape hatch: insert HTML comment `<!-- icon-style-allow-file: <reason> -->` at top of file.');
  process.exit(1);
}

console.log(`✓ icon-style clean (${files.length} svg files scanned, exemptions applied)`);
