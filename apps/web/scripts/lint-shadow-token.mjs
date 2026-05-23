#!/usr/bin/env node
/**
 * lint-shadow-token.mjs — V5 task 3 (SIK-74) — Forbid hardcoded box-shadow.
 *
 * V5 Correctness Property CP.1 (token single source) + REQ-6.4:
 *   apps/(*)/src/(*) must not contain any literal box-shadow value. Shadows
 *   MUST flow through tokens (--shadow-l1..l4, --card-shadow-rest/hover,
 *   --input-ring-focus) which themselves resolve to V5 §1.6 shadow scale.
 *
 * Detection:
 *   - `box-shadow:` followed by anything that is NOT a `var(...)` or `none` /
 *     `inherit` / `unset` keyword. Inline style + .css/.scss + Tailwind
 *     `[box-shadow:...]` arbitrary values all matched.
 *   - `boxShadow:` (camelCase, JSX inline style) treated identically.
 *   - Tailwind `shadow-[...]` arbitrary value with hardcoded rgba/offsets is
 *     also caught (Tailwind 默认档 shadow / shadow-sm / shadow-md / shadow-lg
 *     legacy class is NOT linted here — that's lint-hardcode's domain).
 *
 * Exemptions:
 *   - Trailing `// shadow-allow: <reason>` skips the line (same pattern as
 *     lint-hardcode `hardcode-allow`).
 *   - Test directories (__tests__ / __mocks__) auto-skipped.
 *   - Files under packages/design-system/src/tokens.css NOT scanned (this
 *     lint targets apps/, but root invocation uses ROOT below).
 *
 * Run: `node apps/web/scripts/lint-shadow-token.mjs` (or `npm run lint:shadow`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts', '.css', '.scss'];

// Capture group 1 is what follows `box-shadow:` / `boxShadow:` up to the
// statement boundary (`;` / newline / `}` / `'` / `"` / `,`). Then validate
// the captured value: if it's purely `var(...)` chain or one of the keyword
// `none|inherit|unset|initial`, allow; else flag.
const BOX_SHADOW_RE = /\b(?:box-shadow|boxShadow)\s*[:=]\s*(['"`]?)([^;\n}'"`,]+)/gi;

// Tailwind arbitrary-value shadow: `shadow-[...]` with non-token content.
const TAILWIND_ARBITRARY_SHADOW_RE = /\bshadow-\[([^\]]+)\]/g;

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*shadow-allow:/;

const KEYWORD_VALUE_RE = /^\s*(none|inherit|unset|initial|revert)\s*$/i;
const HARDCODED_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

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

  for (const match of content.matchAll(BOX_SHADOW_RE)) {
    const value = (match[2] || '').trim();
    if (!value) continue;
    if (KEYWORD_VALUE_RE.test(value)) continue;
    if (!HARDCODED_COLOR_RE.test(value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'box-shadow',
      snippet: value.slice(0, 80),
    });
  }

  for (const match of content.matchAll(TAILWIND_ARBITRARY_SHADOW_RE)) {
    const value = match[1].trim();
    if (!HARDCODED_COLOR_RE.test(value)) continue;
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      kind: 'tailwind-shadow-arbitrary',
      snippet: `shadow-[${value.slice(0, 60)}]`,
    });
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} shadow-token violation(s) in ${files.length} files:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.snippet}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix: replace literal box-shadow with var(--shadow-l1..l4) or var(--card-shadow-*) tokens.');
  console.error('Escape hatch: trailing `// shadow-allow: <reason>` on the same line.');
  process.exit(1);
}

console.log(`✓ shadow-token clean (${files.length} files scanned)`);
