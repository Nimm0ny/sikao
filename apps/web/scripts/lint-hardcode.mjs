#!/usr/bin/env node
/**
 * lint-hardcode.mjs — 巡检 hardcode 颜色 / 任意值字号 / 间距违规.
 *
 * 跑 frontend/src 下所有 .tsx/.ts，匹配多类违反 docs/design/style-guide.md
 * 的模式. 命中任一即 exit 1, npm run build / CI 应把本 script 加进流水线.
 *
 * 触发原因 (subagent review 反馈, commit 5a05532):
 *   之前的 grep 巡检模式只看 `bg-blue` `text-red` 等少数前缀, 漏了
 *   `shadow-slate-900/5` 这种 hardcode tint, 以及 .5 step 间距和
 *   `text-[Npx]` 任意值字号.
 *
 * PR4 升级 (Frontend Style Guide v1, 2026-05-12):
 *   新增 hex 字面量 / rgb() / rgba() 检测 (`#RRGGBB` / `#RGB` / `rgb(...)` / `rgba(...)`)
 *   白名单: 注释 / stripComments 自动处理; 文件级 `// lint-allow-hardcode`;
 *   行级 `// hardcode-allow: <reason>`; SVG fill="none"/stroke="currentColor" 默认无害.
 *
 * PR5a 收口 (2026-05-12 lhr 授权): color-literal mode default 从 warn → error.
 *   8 文件 35 hex/rgb 字面量已全清 (LoginArtPanel / LogoMark / FocusCard / ScoreHero /
 *   NoteEditor / Health / QuestionRing / HomeHero). 仅 logo brand color (CLAUDE.md §3.7 颜色
 *   frozen) + markdown qlink 语法示例 (NoteEditor #017) 走 // hardcode-allow 保留 hex.
 *   Escape: LINT_HARDCODE_COLOR_MODE=warn / --color-literals=warn 临时降级.
 *
 * 跨平台 (Node.js 内置 fs, 不依赖 grep / sed). Windows / Linux / Mac 都能跑.
 *
 * 使用: `npm run lint:hardcode`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts'];

// Mode 控制 (跟 ui-copy-ssot 同款机制):
// PR5a 起 hex / rgb 字面量规则默认 error (lhr 2026-05-12 授权; 8 文件 35 hits 全清).
// 临时降级: LINT_HARDCODE_COLOR_MODE=warn / --color-literals=warn (CI / 排查用).
// 其它规则 (tailwind 默认调色 / 任意值字号 / 间距) 一直 error, 不受本 flag 影响.
function getColorLiteralMode() {
  const argMode = process.argv.find((a) => a.startsWith('--color-literals='));
  if (argMode) return argMode.slice('--color-literals='.length);
  if (process.env.LINT_HARDCODE_COLOR_MODE === 'warn') return 'warn';
  return 'error';
}
const COLOR_LITERAL_MODE = getColorLiteralMode();

// 文件级 escape (顶 20 行内出现即跳过整文件)
const ALLOW_FILE_RE = /\/\/\s*lint-allow-hardcode/;

// 路径白名单 (相对 src/) — 这些路径下散落 hex 视为合法
const WHITELIST_PATH_PREFIXES = [
  'styles/',                  // tokens.css 自身 / 其他设计 token CSS
  'assets/illustrations/',    // SVG illustration 内置色
  'views/marketing/',         // marketing landing 装饰色
  'views/landing/',           // landing variant (预留)
];

function inWhitelistPath(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  return WHITELIST_PATH_PREFIXES.some((p) => rel.startsWith(p));
}

// 把 `/* ... */` 块注释 / `// ...` 行注释 / `{/* ... */}` JSX 注释替换成等长空白
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

const PATTERNS = [
  {
    name: 'tailwind-default-color',
    regex: /\b(text|bg|border|ring|fill|stroke|from|to|via|shadow|divide|outline|placeholder|caret|decoration)-(slate|blue|red|green|yellow|orange|purple|pink|indigo|cyan|teal|emerald|sky|violet|amber|rose|fuchsia|gray|zinc|neutral|stone|lime)-\d{2,3}\b/g,
    desc:
      'Tailwind 默认调色板硬码（绕过产品 token，dark theme 不响应）。' +
      '用 brand / ink / accent / danger / warn / success / sidebar token 替代',
  },
  {
    name: 'arbitrary-text-px',
    regex: /\btext-\[\d+(\.\d+)?px\]/g,
    desc:
      '任意值字号（违反 §4.2 type ramp + §10.3 自创 token）。' +
      '用 fs-* token class (text-xs/sm/base/md/lg/xl/...) 或语义 alias ' +
      '(text-eyebrow / text-h-card / text-h-section / text-h-mkt / text-display) 替代',
  },
  {
    name: 'half-step-spacing',
    regex: /\b(m[trblxy]?|p[trblxy]?|gap|space-[xy])-\d+\.5\b/g,
    desc:
      '.5 step 间距（违反 §5.1 8px 阶梯：4·8·12·16·20·24·32·40·56·80）。' +
      '上调到下一个整数 step (0.5→1 / 1.5→2 / 2.5→3 / 3.5→4 / 4.5→5)',
  },
  {
    name: 'arbitrary-radius-px',
    regex: /\brounded(-[trbl]{1,2})?-\[\d+(\.\d+)?px\]/g,
    desc:
      '任意值圆角（违反 §6 radius token：tokens.css 已定义 ' +
      '--radius-pill / --radius-card / --radius-card-lg / --radius-btn / --radius-chip）。' +
      '用 rounded-pill / rounded-card / rounded-card-lg / rounded-btn / rounded-chip',
  },
  {
    name: 'arbitrary-gap-px',
    regex: /\bgap-\[\d+(\.\d+)?px\]/g,
    desc:
      '任意值 gap（违反 §5.1 8px 阶梯）。' +
      '用 gap-1 / gap-2 / gap-3 / gap-4 / gap-5 / gap-6 / gap-8 / gap-10 / gap-14 / gap-20',
  },
  {
    // 只查 margin/padding/space/inset, 不查 w/h/min-w/max-w 等 dimension
    // (marketing layout 合理需要任意 px container width, e.g. max-w-[1160px]).
    name: 'arbitrary-spacing-px',
    regex: /\b(m[trblxy]?|p[trblxy]?|space-[xy]|top|right|bottom|left|inset)-\[\d+(\.\d+)?px\]/g,
    desc:
      '任意值 margin/padding/inset（违反 §5.1 8px 阶梯）。' +
      '用整数 step (4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80). ' +
      'Container width / size 等 dimension 不在本规则范围 (允许任意 px).',
  },
  // PR4 新增 (Frontend Style Guide v1): hex / rgb / rgba 字面量.
  // 颜色统一走 token (var(--paper-*) / var(--ink-*) / var(--accent-*) 等),
  // 散落 hex 会跳过 dark mode 切换 + 设计系统调色.
  // 白名单:
  //   - styles/ 路径 (token 定义自身)
  //   - assets/illustrations/ (SVG 插画内置色)
  //   - views/marketing/ + views/landing/ (装饰色)
  //   - 行级 // hardcode-allow: <reason>
  //   - 文件级 // lint-allow-hardcode
  //   - SVG fill="none" / stroke="currentColor" (跑模式不匹配, 自然过)
  {
    name: 'hex-color-literal',
    regex: /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g,
    desc:
      'hex 颜色字面量（违反设计 token SSOT）。' +
      '用 var(--paper-1/2/3) / var(--ink-1/2/3/4) / var(--accent-1/2) / var(--line-1/2/3) / var(--ok/warn/err) ' +
      '等 token 替代. styles/ + assets/illustrations/ + marketing/ + landing/ 路径在白名单.',
  },
  {
    name: 'rgb-color-literal',
    regex: /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g,
    desc:
      'rgb()/rgba() 颜色字面量（违反设计 token SSOT）。' +
      '改 var(--*) token; 半透明走 color-mix(in oklch, var(--*), transparent N%) 或 token alpha 变体.',
  },
];

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
      !full.endsWith('.test.ts') &&
      !full.endsWith('.spec.ts') &&
      !full.endsWith('.stories.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

const files = listFiles(ROOT);
const violations = [];          // hard-fail 规则 (tailwind / 任意值 / 间距)
const colorLiteralReports = []; // hex / rgb / rgba 字面量 (默认 warn-only)

// Escape hatch: 在 hardcode 那一行尾加 `// hardcode-allow: <reason>` 或
// JSX 里 `{/* hardcode-allow: <reason> */}` 跳过本行 lint.
// 适用 sub-pixel 微调 (drag handle, border alignment, motion overlay) 等
// 设计 SSOT 之外的合理 fine-tune. 必须写 reason, 否则 LHR 半年后看不懂.
const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*hardcode-allow:/;

function lineHasAllowComment(content, lineNum) {
  const lines = content.split('\n');
  return lines[lineNum - 1] && ALLOW_RE.test(lines[lineNum - 1]);
}

// hex / rgb 规则跑在已 stripComments 的 content 上 (注释里的 hex 不算违规).
// 其它规则 (tailwind class / 任意值字号) 跑原文 — Tailwind className 在 JSX prop
// 内, stripComments 不改 string 里的内容, 行为一致.
const CLEAN_CONTENT_RULES = new Set(['hex-color-literal', 'rgb-color-literal']);
// Color literal 规则在默认 mode (warn-only) 时收到独立列表, error mode 才合入 violations.
const COLOR_LITERAL_RULES = new Set(['hex-color-literal', 'rgb-color-literal']);

for (const file of files) {
  // 路径白名单 — styles/ + assets/illustrations/ + marketing/ + landing/ skip
  if (inWhitelistPath(file)) continue;
  const rawContent = readFileSync(file, 'utf8');
  // 文件级 escape (首 20 行内 // lint-allow-hardcode)
  if (ALLOW_FILE_RE.test(rawContent.split('\n').slice(0, 20).join('\n'))) continue;

  const cleanContent = stripComments(rawContent);
  for (const { name, regex } of PATTERNS) {
    const useContent = CLEAN_CONTENT_RULES.has(name) ? cleanContent : rawContent;
    const isColorLiteralRule = COLOR_LITERAL_RULES.has(name);
    // 重置 lastIndex 以便重复执行 matchAll on 新 content
    const matches = [...useContent.matchAll(regex)];
    for (const match of matches) {
      const lineNum = useContent.slice(0, match.index).split('\n').length;
      if (lineHasAllowComment(rawContent, lineNum)) continue;
      const entry = {
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        rule: name,
        snippet: match[0],
      };
      if (isColorLiteralRule && COLOR_LITERAL_MODE !== 'error') {
        colorLiteralReports.push(entry);
      } else {
        violations.push(entry);
      }
    }
  }
}

// warn mode (临时降级): 输出 color literal 报告到 stderr, 但不 exit 1.
// PR5a 起默认 error mode, 命中即合入 violations 而非 colorLiteralReports.
if (colorLiteralReports.length > 0) {
  console.error(
    `\n⚠ ${colorLiteralReports.length} hex/rgb color-literal warning(s) (warn mode, mode=${COLOR_LITERAL_MODE}):`,
  );
  for (const v of colorLiteralReports) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.snippet}`);
  }
  console.error(
    `\n  PR5a (2026-05-12) 默认 error mode; warn 仅在 LINT_HARDCODE_COLOR_MODE=warn / --color-literals=warn 时启用.\n` +
      `  规范: 颜色统一走 var(--*) token (半透明走 color-mix(in oklch, var(--*), transparent N%)).`,
  );
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} hardcode violation(s) found in ${files.length} files:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.snippet}`);
  }
  console.error(`\n规则说明:`);
  for (const { name, desc } of PATTERNS) {
    console.error(`  - ${name}\n    ${desc}`);
  }
  console.error(
    `\n规范来源: docs/design/style-guide.md §3 / §4 / §5 / §10.3`
  );
  process.exit(1);
}

console.log(`✓ No hardcode hard violations across ${files.length} files`);
console.log(
  `  Patterns checked: ${PATTERNS.map((p) => p.name).join(' / ')}` +
    (colorLiteralReports.length > 0
      ? ` (${colorLiteralReports.length} color-literal warning(s) above, warn-only)`
      : ''),
);
