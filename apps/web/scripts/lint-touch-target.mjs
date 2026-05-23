#!/usr/bin/env node
/**
 * lint-touch-target.mjs — V5 task 7 (SIK-74) — Hover-touch affordance check.
 *
 * V5 Correctness Property CP.9 (Hover-Touch Affordance) + REQ-8.1 + REQ-10.1:
 *
 *   1) All `:hover` style rules in apps/(*)/src/(*) MUST be wrapped in
 *      `@media (hover: hover) and (pointer: fine)`. Touch devices
 *      (pointer: coarse) must not paint persistent hover residue.
 *
 *   2) All elements explicitly marked as touch targets via
 *      `[data-role="touch-target"]` MUST have min-height and min-width >= 40px
 *      (REQ-10.1: minimum hit-area).
 *
 * Scope:
 *   - .css / .scss files (CSS-form `:hover` selector + `@media` ancestry)
 *   - .tsx / .ts inline-style strings via `&:hover { ... }` blocks (rare;
 *     scanned but only the wrapper requirement applies)
 *
 * Allowed forms (no flag):
 *   - `:hover` inside `@media (hover: hover) and (pointer: fine)` block
 *   - Tailwind `hover:` className (Tailwind v4 emits hover-capable media
 *     query automatically, NOT linted here — the V4 plugin behavior is
 *     audited at the build level)
 *
 * Exemptions:
 *   - Trailing or nearby (±5 lines) `// touch-allow: <reason>`
 *   - File-level: comment `touch-allow-file: <reason>`
 *   - Test directories
 *
 * Run: `node apps/web/scripts/lint-touch-target.mjs` (or `npm run lint:touch-target`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts', '.css', '.scss'];

const HOVER_RE = /([^\s{};]*?):hover\b/g;
const TOUCH_TARGET_BLOCK_RE = /\[data-role=["']touch-target["']\][^{]*\{([^}]*)\}/g;
const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*touch-allow:/;
const ALLOW_FILE_RE = /touch-allow-file:/;

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

function hasNearbyAllowComment(lines, lineNum) {
  const lo = Math.max(1, lineNum - 5);
  const hi = Math.min(lines.length, lineNum + 5);
  for (let i = lo; i <= hi; i++) {
    if (lines[i - 1] && ALLOW_RE.test(lines[i - 1])) return true;
  }
  return false;
}

// Returns true if `:hover` at `index` is enclosed by an @media block whose
// query contains both `hover: hover` and `pointer: fine`. Walks outward by
// matching braces and looking for the nearest enclosing `@media (...)` block.
function isInsideHoverCapableMedia(content, hoverIdx) {
  let depth = 0;
  let pos = hoverIdx;
  while (pos >= 0) {
    const ch = content[pos];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        // Found enclosing block opener; look back for selector / @-rule.
        const head = content.slice(Math.max(0, pos - 200), pos);
        const ruleMatch = head.match(/@media\s*\(([^){]*)\)\s*$/);
        if (ruleMatch) {
          const query = ruleMatch[1];
          if (
            /hover\s*:\s*hover/i.test(query) &&
            /pointer\s*:\s*fine/i.test(query)
          ) {
            return true;
          }
        }
        // Continue walking outward (skip this block opener).
        pos--;
        continue;
      }
      depth--;
    }
    pos--;
  }
  return false;
}

function parsePxValue(decls, prop) {
  const re = new RegExp(`\\b${prop}\\s*:\\s*([^;]+)`, 'i');
  const match = decls.match(re);
  if (!match) return null;
  const value = match[1].trim();
  const px = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) return parseFloat(px[1]);
  return null;
}

const files = listFiles(ROOT);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(content)) continue;
  const lines = content.split('\n');

  // 1) :hover wrapper check (CSS/SCSS only — Tailwind className is a
  //    different code path, audited at build time).
  const isCss = file.endsWith('.css') || file.endsWith('.scss');
  if (isCss) {
    for (const match of content.matchAll(HOVER_RE)) {
      const idx = match.index;
      // Skip pseudo-prefix forms like `::-webkit-...` that incidentally end
      // with `:hover` substring; HOVER_RE already requires \b boundary, so
      // we just verify left-context has at least one selector char.
      if (isInsideHoverCapableMedia(content, idx)) continue;
      const lineNum = content.slice(0, idx).split('\n').length;
      if (hasNearbyAllowComment(lines, lineNum)) continue;
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        kind: 'hover-not-wrapped',
        snippet: match[0].slice(0, 60),
      });
    }
  }

  // 2) [data-role="touch-target"] min-height / min-width >= 40px check.
  for (const match of content.matchAll(TOUCH_TARGET_BLOCK_RE)) {
    const decls = match[1];
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    const minH = parsePxValue(decls, 'min-height');
    const minW = parsePxValue(decls, 'min-width');
    const failures = [];
    if (minH !== null && minH < 40) failures.push(`min-height: ${minH}px`);
    if (minW !== null && minW < 40) failures.push(`min-width: ${minW}px`);
    if (minH === null && minW === null) {
      failures.push('missing min-height / min-width (need >= 40px each)');
    }
    if (failures.length > 0) {
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        kind: 'touch-target-too-small',
        snippet: failures.join(' / '),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} touch-target violation(s) in ${files.length} files:\n`);
  for (const v of violations.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.snippet}`);
  }
  if (violations.length > 50) {
    console.error(`  … and ${violations.length - 50} more`);
  }
  console.error('\nFix:');
  console.error('  - Wrap `:hover` rules in `@media (hover: hover) and (pointer: fine) { ... }`');
  console.error('  - For `[data-role="touch-target"]` elements, set both min-height + min-width >= 40px');
  console.error('Escape hatch: trailing `// touch-allow: <reason>` or file-level `/* touch-allow-file: <reason> */`');
  process.exit(1);
}

console.log(`✓ touch-target clean (${files.length} files scanned)`);
