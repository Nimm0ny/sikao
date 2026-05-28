#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const APPS_ROOT = join(REPO_ROOT, 'apps');
const EXTS = ['.css', '.ts', '.tsx'];

const ALLOW_FILE_RE = /font-family-token-allow-file:/;
const ALLOW_LINE_RE = /font-family-token-allow:/;

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

function listAppSourceRoots() {
  if (!existsSync(APPS_ROOT)) return [join(APP_ROOT, 'src')];
  const roots = [];
  for (const entry of readdirSync(APPS_ROOT)) {
    const full = join(APPS_ROOT, entry);
    const st = statSync(full);
    if (!st.isDirectory()) continue;
    const srcRoot = join(full, 'src');
    if (existsSync(srcRoot)) roots.push(srcRoot);
  }
  return roots;
}

const targetFiles = listAppSourceRoots().flatMap(listFiles);
const violations = [];
for (const file of targetFiles) {
  const raw = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(raw)) continue;
  const lines = raw.split('\n');
  lines.forEach((line, index) => {
    if (ALLOW_LINE_RE.test(line)) return;
    const hasCssFamily = /font-family\s*:/.test(line);
    const hasJsFamily = /fontFamily\s*:/.test(line);
    const hasFontShorthand = /\bfont\s*:/.test(line);
    if (!hasCssFamily && !hasJsFamily && !hasFontShorthand) return;

    const allowed =
      /font\s*:\s*inherit/.test(line) ||
      /font-family\s*:\s*inherit/.test(line) ||
      /font-family\s*:\s*var\(--font-family-(ui|ui-secondary|mono)\)/.test(line) ||
      /fontFamily\s*:\s*['"]inherit['"]/.test(line) ||
      /fontFamily\s*:\s*['"]var\(--font-family-(ui|ui-secondary|mono)\)['"]/.test(line);

    if (!allowed) {
      violations.push({
        file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} font-family token violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error(
    '\nUse only var(--font-family-ui), var(--font-family-ui-secondary), var(--font-family-mono), or inherit in apps/*/src/**. `font:` shorthand is allowed only as `font: inherit`.',
  );
  process.exit(1);
}

console.log(`✓ No font-family token violations across ${targetFiles.length} files`);
