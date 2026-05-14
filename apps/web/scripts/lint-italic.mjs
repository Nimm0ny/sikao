#!/usr/bin/env node
/**
 * lint-italic.mjs — 巡检 italic 违规.
 *
 * CLAUDE.md §4 「italic 政策」: 默认禁 `italic` / `font-italic` className.
 * 三类例外:
 *   1. serif 数字强调 (StatCallout / ScoreRing / Badge.count 等) — D2c
 *   2. ASCII editorial 符号 (← → + − × /) — D3a
 *   3. error page SVG illustration (404/500) — style-guide §4.1
 *
 * CJK 字符 (中文 / 日文 / 全角标点) 禁 italic.
 *
 * 实现思路: 用 Node fs walker (lint-hardcode.mjs 同款), 找含 `\bitalic\b`
 * / `font-italic` 的 className 字符串, 抓 className 所在 JSX 元素的子文本节点
 * 字符. 字符落在
 *   - CJK Unified Ideographs (U+4E00-U+9FFF)
 *   - CJK Symbols and Punctuation (U+3000-U+303F)
 *   - Halfwidth and Fullwidth Forms (U+FF00-U+FFEF)
 * 即触发违规. 否则放过 (数字 / ASCII / template var $ {} 都合法).
 *
 * 已知限制: 不真解析 JSX AST (需引 babel parser, 加重 dep). 用 regex 定位
 * className -> 上下文文本, 在 JSX 嵌套深时**会漏报**. 但本 lint 是 backstop,
 * primary 防线是 master agent + subagent review. 漏报代价是设计调性 P1, 不是
 * 功能性 bug, 接受.
 *
 * Escape hatch: 行尾 `// italic-allow: <reason>` (跟 lint-hardcode `hardcode-allow`
 * 同款), 必须写 reason. 测试目录 (`__tests__/` / `__mocks__/`) 自动 skip 不报.
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:italic`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts'];

const CJK_RANGES = [
  [0x4e00, 0x9fff],
  [0x3000, 0x303f],
  [0xff00, 0xffef],
];

function hasCJK(str) {
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    for (const [lo, hi] of CJK_RANGES) {
      if (cp >= lo && cp <= hi) return true;
    }
  }
  return false;
}

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*italic-allow:/;

function lineHasAllowComment(content, lineNum) {
  const lines = content.split('\n');
  return lines[lineNum - 1] && ALLOW_RE.test(lines[lineNum - 1]);
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

const ITALIC_RE = /\b(?:italic|font-italic)\b/g;

// 把 `/* ... */` 块注释 / `// ...` 行注释 / `{/* ... */}` JSX 注释替换成等长空白,
// 让正则不在注释里命中 (jsdoc 提到 "italic" 是 design system 文档, 非违规).
// 保留长度让 lineNum / matchStart 偏移不变.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

const files = listFiles(ROOT);
const violations = [];

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  const content = stripComments(rawContent);
  const matches = [...content.matchAll(ITALIC_RE)];
  for (const match of matches) {
    const matchStart = match.index;
    const lineNum = content.slice(0, matchStart).split('\n').length;
    if (lineHasAllowComment(content, lineNum)) continue;

    const tagEnd = content.indexOf('>', matchStart);
    if (tagEnd === -1) continue;
    const textStart = tagEnd + 1;
    let textEnd = textStart;
    while (
      textEnd < content.length &&
      content[textEnd] !== '<' &&
      content[textEnd] !== '\n'
    ) {
      textEnd++;
    }
    const text = content.slice(textStart, textEnd).trim();
    if (text === '') continue;
    if (!hasCJK(text)) continue;

    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      snippet: text.length > 40 ? text.slice(0, 40) + '...' : text,
    });
  }
}

if (violations.length > 0) {
  console.error(
    `✗ ${violations.length} italic-on-CJK violation(s) found in ${files.length} files:\n`
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  italic + 中文 → "${v.snippet}"`);
  }
  console.error(
    `\n规则 (CLAUDE.md §4 italic 政策):\n` +
      `  - CJK 字符 (U+4E00-U+9FFF / U+3000-U+303F / U+FF00-U+FFEF) 禁 italic\n` +
      `  - 三类例外: serif 数字 / ASCII 编辑符号 / error page SVG\n` +
      `  - 修法: 删 italic 保 font-serif, 中文 title 走 Songti SC 不倾斜\n` +
      `  - Escape hatch: 行尾 \`// italic-allow: <reason>\``
  );
  process.exit(1);
}

console.log(`✓ No italic-on-CJK violations across ${files.length} files`);
