#!/usr/bin/env node
/**
 * lint-breadcrumb-comments.mjs — audit implementation-history breadcrumb comments.
 *
 * Slice 9 requires a guardrail for comment cleanup, but current page slices still carry
 * historical rollout notes. This script now fails by default so touched files
 * cannot re-introduce rollout-history comments silently.
 *
 * Scope:
 *   - apps/web/src/views/**
 *   - apps/web/src/router/**
 *   - apps/web/src/components/mvp/index.tsx
 *
 * Rejected comment patterns come from docs/audit/current-breadcrumb-comment-inventory.md:
 *   PR* / Wave* / Phase* / Round* / hifi / batch / handoff / commit /
 *   temporary implementation history
 *
 * Modes:
 *   - default error (exit 1)
 *   - --mode=warn or LINT_BREADCRUMB_MODE=warn (exit 0)
 *
 * Escape hatch:
 *   - line-level `// breadcrumb-allow: <reason>`
 *   - file-level `// lint-allow-breadcrumb` within first 20 lines
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.ts', '.tsx'];
const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*breadcrumb-allow:/;
const ALLOW_FILE_RE = /\/\/\s*lint-allow-breadcrumb/;
const TARGET_PREFIXES = ['views/', 'router/'];
const TARGET_FILES = new Set(['components/mvp/index.tsx']);

const COMMENT_RE = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g;
const PATTERNS = [
  { name: 'PR*', regex: /\bPR\d+[A-Za-z-]*\b/i },
  { name: 'Wave*', regex: /\bWave\s*\d+[A-Za-z-]*\b/i },
  { name: 'Phase*', regex: /\bPhase\s*[A-Za-z0-9.-]+\b/i },
  { name: 'Round*', regex: /\bRound\s*\d+[A-Za-z-]*\b/i },
  { name: 'hifi', regex: /\bhifi\b/i },
  { name: 'batch', regex: /\bbatch\b/i },
  { name: 'handoff', regex: /\bhandoff\b/i },
  { name: 'commit', regex: /\bcommit\b/i },
  { name: 'temporary implementation history', regex: /temporary implementation history/i },
];

function getMode() {
  const argMode = process.argv.find((arg) => arg.startsWith('--mode='));
  if (argMode) return argMode.slice('--mode='.length);
  if (process.env.LINT_BREADCRUMB_MODE === 'warn') return 'warn';
  return 'error';
}

const MODE = getMode();

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...listFiles(full));
      continue;
    }
    if (
      EXTS.some((ext) => full.endsWith(ext)) &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.test.tsx') &&
      !full.endsWith('.spec.ts') &&
      !full.endsWith('.spec.tsx') &&
      !full.endsWith('.stories.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

function isTargetFile(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  return TARGET_PREFIXES.some((prefix) => rel.startsWith(prefix)) || TARGET_FILES.has(rel);
}

function lineHasAllowComment(lines, lineNum) {
  const line = lines[lineNum - 1];
  return Boolean(line && ALLOW_RE.test(line));
}

function collectViolations(file, content) {
  const relFile = relative(process.cwd(), file).replace(/\\/g, '/');
  const lines = content.split('\n');
  const violations = [];

  for (const match of content.matchAll(COMMENT_RE)) {
    const comment = match[0];
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (lineHasAllowComment(lines, lineNum)) continue;

    for (const pattern of PATTERNS) {
      const patternMatch = pattern.regex.exec(comment);
      if (!patternMatch) continue;
      violations.push({
        file: relFile,
        line: lineNum,
        pattern: pattern.name,
        snippet: patternMatch[0],
      });
    }
  }

  return violations;
}

const files = listFiles(ROOT).filter(isTargetFile);
const violations = [];

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(rawContent.split('\n').slice(0, 20).join('\n'))) continue;
  violations.push(...collectViolations(file, rawContent));
}

if (violations.length > 0) {
  const isError = MODE === 'error';
  const icon = isError ? '✗' : '⚠';
  const label = isError ? 'violation(s)' : 'warning(s)';
  const modeNote = isError ? '' : ' (warn-only mode)';

  console.error(
    `\n${icon} ${violations.length} breadcrumb-comment ${label}${modeNote} across ${files.length} files:\n`,
  );
  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line}  ${violation.pattern} -> "${violation.snippet}"`,
    );
  }
  console.error(
    `\n规则 (docs/audit/current-breadcrumb-comment-inventory.md):\n` +
      `  - 触达页面 slice 时，清理只记录 PR / Wave / Phase / Round / hifi / batch / handoff / commit 历史的注释\n` +
      `  - 允许保留稳定业务规则、API 契约、a11y 约束、fail-fast exception 等注释\n` +
      `  - Mode: ${MODE}; 切换为 hard fail 用 --mode=error 或 LINT_BREADCRUMB_MODE=error\n` +
      `  - Escape hatch: 行尾 \`// breadcrumb-allow: <reason>\` 或文件级 \`// lint-allow-breadcrumb\``,
  );

  if (isError) process.exit(1);
}

if (violations.length === 0) {
  console.log(`✓ No breadcrumb-comment violations across ${files.length} files (mode=${MODE})`);
}
