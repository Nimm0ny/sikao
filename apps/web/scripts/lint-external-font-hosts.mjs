#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const APPS_ROOT = join(REPO_ROOT, 'apps');
const INCLUDE_DIST = process.argv.includes('--include-dist');
const EXTS = ['.css', '.scss', '.ts', '.tsx', '.html', '.svg', '.js', '.mjs'];
const BLOCKED = [
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
];

function listFiles(target) {
  if (!existsSync(target)) return [];
  const st = statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const entry of readdirSync(target)) {
    const full = join(target, entry);
    const entryStat = statSync(full);
    if (entryStat.isDirectory()) {
      if (entry === 'node_modules') continue;
      out.push(...listFiles(full));
    } else if (EXTS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function listAppRoots() {
  if (!existsSync(APPS_ROOT)) return [APP_ROOT];
  const roots = [];
  for (const entry of readdirSync(APPS_ROOT)) {
    const full = join(APPS_ROOT, entry);
    const st = statSync(full);
    if (st.isDirectory()) roots.push(full);
  }
  return roots;
}

const scanRoots = [
  ...listAppRoots().flatMap((appRoot) => {
    const targets = [
      join(appRoot, 'src'),
      join(appRoot, 'public'),
      join(appRoot, 'index.html'),
    ];
    if (INCLUDE_DIST) targets.push(join(appRoot, 'dist'));
    return targets;
  }),
  join(REPO_ROOT, 'packages', 'design-system', 'src'),
];

const files = scanRoots.flatMap(listFiles);
const violations = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  lines.forEach((line, index) => {
    const isGoogleFontContext =
      /fonts?\.googleapis|fonts?\.gstatic|preconnect|stylesheet|@import|@font-face|src:\s*url\(/i.test(line);
    const isRemoteFontSrc =
      /src:\s*url\(\s*https?:\/\//i.test(line);
    if ((isGoogleFontContext && BLOCKED.some((re) => re.test(line))) || isRemoteFontSrc) {
      violations.push({
        file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} external-font host violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error('\nRuntime and build outputs must not reference external font hosts; use self-hosted font assets only.');
  process.exit(1);
}

console.log(`✓ No external-font host violations across ${files.length} files${INCLUDE_DIST ? ' (including dist)' : ''}`);
