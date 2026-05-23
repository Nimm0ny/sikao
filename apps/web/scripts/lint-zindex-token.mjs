#!/usr/bin/env node
/**
 * lint-zindex-token.mjs — V5 task 4 (SIK-74) — Forbid hardcoded z-index numbers.
 *
 * V5 Correctness Property CP.1 (token single source) + REQ-6.4:
 *   apps/(*)/src/(*) must not contain `z-index: <number>` literals. All
 *   stacking context tokens MUST flow through `--z-rail / --z-topbar /
 *   --z-popover / --z-modal / --z-toast` (V5 §4.6 component layer), each
 *   layer separated by ≥10 to allow third-party plug-in.
 *
 * Detection:
 *   - `z-index: <num>` (CSS / SCSS / inline style string)
 *   - `zIndex: <num>` (camelCase, JSX inline style)
 *   - Tailwind `z-[<num>]` arbitrary value
 *   - Tailwind `z-0`/`z-10`/`z-20`/`z-30`/`z-40`/`z-50`/`z-auto` defaults are
 *     also flagged — the V5 SSOT mandates token usage, not Tailwind's preset
 *     ladder. Tests / Storybook fixtures stay exempt via __tests__ skip.
 *
 * Allowed values (no flag):
 *   - `var(--z-*)` chain
 *   - keywords: auto / inherit / unset / initial / revert
 *   - the literal `0` (CSS reset, equivalent to auto stacking)
 *
 * Exemptions:
 *   - Trailing or nearby (±5 lines) `// zindex-allow: <reason>` skips the line
 *   - Test directories (__tests__ / __mocks__) auto-skipped
 *
 * Run: `node apps/web/scripts/lint-zindex-token.mjs` (or `npm run lint:zindex`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts', '.css', '.scss'];

const Z_INDEX_RE = /\b(?:z-index|zIndex)\s*[:=]\s*(['"`]?)([^;\n}'"`,]+)/gi;
const TAILWIND_Z_DEFAULT_RE = /\bz-(?:0|10|20|30|40|50|auto)\b/g;
const TAILWIND_Z_ARBITRARY_RE = /\bz-\[([^\]]+)\]/g;

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*zindex-allow:/;
const KEYWORD_VALUE_RE = /^\s*(auto|inherit|unset|initial|revert|0)\s*$/i;
const VAR_ONLY_RE = /^\s*var\(--z-[a-z0-9-]+\)\s*$/i;

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

  for (const match of content.matchAll(Z_INDEX_RE)) {
    const value = (match[2] || '').trim();
    if (!value) continue;
    if (KEYWORD_VALUE_RE.test(value)) continue;
    if (VAR_ONLY_RE.test(value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'z-index-literal',
      snippet: value.slice(0, 60),
    });
  }

  for (const match of content.matchAll(TAILWIND_Z_DEFAULT_RE)) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'tailwind-z-default',
      snippet: match[0],
    });
  }

  for (const match of content.matchAll(TAILWIND_Z_ARBITRARY_RE)) {
    const value = match[1].trim();
    if (VAR_ONLY_RE.test(value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'tailwind-z-arbitrary',
      snippet: `z-[${value.slice(0, 40)}]`,
    });
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} z-index-token violation(s) in ${files.length} files:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.snippet}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: replace literal z-index with var(--z-rail/topbar/popover/modal/toast).');
  console.error('Escape hatch: trailing `// zindex-allow: <reason>` on the same line.');
  process.exit(1);
}

console.log(`✓ z-index-token clean (${files.length} files scanned)`);
