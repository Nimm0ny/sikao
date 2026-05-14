#!/usr/bin/env node
/**
 * lint-ui-copy-ssot.mjs — 巡检 view 内联中文文案的 SSOT 漂移.
 *
 * docs/plan/frontend-style-guide-v1-migration.md §4 PR4:
 *   - frontend/src/{views,components}/** 路径下, JSX text node / placeholder /
 *     aria-label 内 > 4 中文字符的字面量, 必须来自 @/lib/ui-copy import
 *   - 初期 warn-only mode (退出码 0), PR5 后 lhr 决定转 error
 *
 * 实现思路:
 *   - regex 抓 JSX text node 中字符 [一-鿿]{5,}
 *   - 抓 attribute placeholder="..." / aria-label="..." 字面量
 *   - 检查同文件 import 是否含 `from '@/lib/ui-copy'` / `from '../lib/ui-copy'`
 *   - 未 import 即触发 (warn-only / error 取决于 mode)
 *
 * Mode 控制:
 *   - 默认 `--mode=warn` (退出码 0)
 *   - `--mode=error` (退出码 1, 用于 PR5 后转 hard fail)
 *   - 环境变量 `LINT_UI_COPY_MODE=error` 也支持
 *
 * 白名单 / 例外:
 *   - 路径白名单: views/marketing/ / views/landing/ / assets/illustrations/
 *   - 文件级 `// lint-allow-ui-copy` 顶注 (首 20 行内)
 *   - 行级 `// ui-copy-allow: <reason>`
 *   - <title>...</title> JSX 节点 (pages 标题不强制走 SSOT)
 *   - 测试 / mocks / stories 自动 skip
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:ui-copy-ssot`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx'];

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*ui-copy-allow:/;
const ALLOW_FILE_RE = /\/\/\s*lint-allow-ui-copy/;

// 路径白名单 (marketing / landing / illustrations 不强制走 SSOT)
const WHITELIST_PREFIXES = [
  'views/marketing/',
  'views/landing/',
  'assets/illustrations/',
];

const TARGET_PREFIXES = ['views/', 'components/'];

// 命令行 mode 解析
function getMode() {
  const argMode = process.argv.find((a) => a.startsWith('--mode='));
  if (argMode) return argMode.slice('--mode='.length);
  if (process.env.LINT_UI_COPY_MODE === 'error') return 'error';
  return 'warn';
}
const MODE = getMode();

// >=5 个连续中文字符 (CJK Unified Ideographs)
const CJK_LONG_RE = /[一-鿿]{5,}/g;

// import from '@/lib/ui-copy' / from '../lib/ui-copy' / from 'src/lib/ui-copy'
const UI_COPY_IMPORT_RE =
  /from\s+['"](?:@\/lib\/ui-copy|.*?\/lib\/ui-copy|src\/lib\/ui-copy)['"]/;

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...listFiles(full));
    } else if (
      EXTS.some((ext) => full.endsWith(ext)) &&
      !full.endsWith('.test.tsx') &&
      !full.endsWith('.spec.tsx') &&
      !full.endsWith('.stories.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

function inTargetPath(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  return TARGET_PREFIXES.some((p) => rel.startsWith(p));
}

function inWhitelistPath(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  return WHITELIST_PREFIXES.some((p) => rel.startsWith(p));
}

// 块注释 / 行注释 / JSX 注释替换成等长空白
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

// 判断 match 是否落在 <title>...</title> JSX 节点内
function isInTitleNode(content, matchIndex) {
  // 向前找最近 `<title` 或 `</title>` / 其它 closing tag
  const before = content.slice(Math.max(0, matchIndex - 200), matchIndex);
  const lastTitleOpen = before.lastIndexOf('<title');
  const lastTitleClose = before.lastIndexOf('</title>');
  if (lastTitleOpen > lastTitleClose && lastTitleOpen !== -1) return true;
  return false;
}

const files = listFiles(ROOT)
  .filter(inTargetPath)
  .filter((f) => !inWhitelistPath(f));

const violations = [];

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  // 文件级 escape
  if (ALLOW_FILE_RE.test(rawContent.split('\n').slice(0, 20).join('\n'))) continue;

  const content = stripComments(rawContent);

  // 检查 import 状态
  const hasUiCopyImport = UI_COPY_IMPORT_RE.test(content);
  if (hasUiCopyImport) continue;

  // 找所有 >=5 中文字符的 match (出现位置不限 — JSX text / attribute value / template str 等)
  const matches = [...content.matchAll(CJK_LONG_RE)];
  if (matches.length === 0) continue;

  const lines = content.split('\n');

  for (const m of matches) {
    const matchIndex = m.index;
    const lineNum = content.slice(0, matchIndex).split('\n').length;

    // 行级 escape
    if (ALLOW_RE.test(lines[lineNum - 1] ?? '')) continue;
    // <title> 节点放过 (HTML title — 页面标题)
    if (isInTitleNode(content, matchIndex)) continue;

    const snippet = m[0].length > 30 ? m[0].slice(0, 30) + '...' : m[0];
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      snippet,
    });
  }
}

if (violations.length > 0) {
  const isError = MODE === 'error';
  const icon = isError ? '✗' : '⚠';
  const label = isError ? 'violation(s)' : 'warning(s)';
  const modeNote = isError ? '' : ' (warn-only mode)';

  console.error(
    `\n${icon} ${violations.length} ui-copy-ssot ${label}${modeNote} across ${files.length} files:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  inline CJK >4 chars: "${v.snippet}"`);
  }
  console.error(
    `\n规则 (PR4 — Frontend Style Guide v1 ui-copy SSOT):\n` +
      `  - frontend/src/{views,components}/** 内联中文 >4 字符必须来自 @/lib/ui-copy import\n` +
      `  - 把字面量收编进 ui-copy.ts 对应 namespace (EMPTY / ERROR / AUTH / BYOM / LLM_QA / ESSAY / ...)\n` +
      `  - 然后从该文件 import \`from '@/lib/ui-copy'\` 引用\n` +
      `  - 路径白名单: views/marketing/ / views/landing/\n` +
      `  - Mode: ${MODE} (warn-only / error); 切换 \`--mode=error\` 或 LINT_UI_COPY_MODE=error\n` +
      `  - Escape hatch: 行尾 \`// ui-copy-allow: <reason>\` 或文件级 \`// lint-allow-ui-copy\``,
  );

  if (isError) process.exit(1);
  // warn-only — 退出码 0
}

if (violations.length === 0) {
  console.log(`✓ No ui-copy-ssot violations across ${files.length} files (mode=${MODE})`);
}
