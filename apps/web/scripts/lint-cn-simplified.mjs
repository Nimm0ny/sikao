#!/usr/bin/env node
/**
 * lint-cn-simplified.mjs — 巡检简体中文 / 港台用词 / 中英文空格违规.
 *
 * SIKAO 面向简体中文互联网用户. 文案必须:
 *   - 简体字 (禁繁体字 zh-Hant)
 *   - 大陆用词 (禁港台习惯, 如「登入/登出/档案/软体/视讯」)
 *   - 中英文之间加空格 (推荐, P1 warn)
 *
 * 实现思路: Node fs walker (lint-italic / lint-hardcode 同款), 扫 frontend/src
 * 下 .tsx/.ts 文件. 三类检测:
 *   a) 繁体字 — 高频字典映射, 命中即 error
 *   b) 港台用词 — 词典映射, 命中即 error
 *   c) 中英文紧贴 — regex 检测无空格, 命中即 warning (不 fail)
 *
 * 已知限制:
 *   - 不解析 JSX AST, 检测对象是源码全文 (含 className / 字符串字面量 / JSX text).
 *     繁体字 / 港台词典在代码注释 / 变量名里几乎不会出现, 所以全文扫足够.
 *   - 中英文空格是推荐 (warning), 因为 className / 路径 / 变量名等会有大量 false
 *     positive ("Card 用 px"). 用 warn level 给 reviewer 看, 不 block CI.
 *
 * Escape hatch: 行尾 `// cn-simplified-allow: <reason>` 跳过本行. 测试目录
 * (`__tests__/` / `__mocks__/`) 自动 skip.
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:cn-simplified`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts'];

// ──────────────────────────────────────────────────────────────────────────
// a) 繁体字 → 简体字 高频映射 (~50 字)
// 不全, 兜底 Wave 12 Phase 2/3 主要 P0; 后续遇到漏报追加.
// ──────────────────────────────────────────────────────────────────────────
const TRADITIONAL_MAP = {
  '國': '国', '學': '学', '開': '开', '對': '对', '應': '应',
  '樣': '样', '點': '点', '個': '个', '還': '还', '進': '进',
  '過': '过', '這': '这', '來': '来', '時': '时', '為': '为',
  '與': '与', '給': '给', '從': '从', '體': '体', '業': '业',
  '動': '动', '區': '区', '變': '变', '義': '义', '樂': '乐',
  '觀': '观', '寫': '写', '飯': '饭', '兒': '儿', '風': '风',
  '馬': '马', '顯': '显', '號': '号', '線': '线', '龍': '龙',
  '雙': '双', '燈': '灯', '紀': '纪', '麗': '丽', '證': '证',
  '認': '认', '識': '识', '詞': '词', '語': '语', '際': '际',
  '圖': '图', '團': '团', '處': '处', '場': '场', '廠': '厂',
  '標': '标', '簡': '简',
};

// ──────────────────────────────────────────────────────────────────────────
// b) 港台习惯用词 → 大陆习惯用词
// 「网址」「公众号」「视频」是大陆习惯, 不警告. 港台特有词才报.
// ──────────────────────────────────────────────────────────────────────────
const HK_TW_PHRASES = [
  { phrase: '登入', suggestion: '登录' },
  { phrase: '登出', suggestion: '退出' },
  { phrase: '档案', suggestion: '文件' },
  { phrase: '軟體', suggestion: '软件' },
  { phrase: '软体', suggestion: '软件' },
  { phrase: '視訊', suggestion: '视频' },
  { phrase: '视讯', suggestion: '视频' },
  { phrase: '寫真', suggestion: '照片' },
  { phrase: '滑鼠', suggestion: '鼠标' },
  { phrase: '螢幕', suggestion: '屏幕' },
  { phrase: '荧幕', suggestion: '屏幕' },
  { phrase: '記憶體', suggestion: '内存' },
  { phrase: '硬碟', suggestion: '硬盘' },
  { phrase: '伺服器', suggestion: '服务器' },
  { phrase: '網路', suggestion: '网络' },
  { phrase: '網頁', suggestion: '网页' },
  { phrase: '影片', suggestion: '视频' },
  { phrase: '解析度', suggestion: '分辨率' },
];

// ──────────────────────────────────────────────────────────────────────────
// c) 中英文紧贴 (无空格) — 推荐 warning
// CJK Unified Ideographs (U+4E00-U+9FFF) 紧贴 ASCII 字母 / 字母紧贴 CJK
// 例: "测试ABC" → warn; "测试 ABC" → OK
// ──────────────────────────────────────────────────────────────────────────
const CJK_ASCII_RE = /[一-鿿][a-zA-Z]|[a-zA-Z][一-鿿]/g;

// ──────────────────────────────────────────────────────────────────────────
// Escape hatch + 注释剥离
// ──────────────────────────────────────────────────────────────────────────
const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*cn-simplified-allow:/;

function lineHasAllowComment(content, lineNum) {
  const lines = content.split('\n');
  return lines[lineNum - 1] && ALLOW_RE.test(lines[lineNum - 1]);
}

// 把 `/* ... */` / `// ...` / `{/* ... */}` 替换成等长空白, 让正则不在注释里命中.
// (本 lint 的字典含中文, 注释里讨论用词差异时可能误报.)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

// 把 JS 字符串字面量里的 escape sequence (\n / \t / \r / \\) 替换成等长空白, 避免
// `\n` 在源码里被当成字面 "n" 紧贴 CJK 误报 (e.g. "立意\n例子" 会扫成 "n例" 中英紧贴).
// 不真解析字符串边界 (要 AST), 直接全文剥离够用.
function stripEscapes(src) {
  return src.replace(/\\[ntrbf"'\\]/g, '  ');
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
      // skip vitest 测试文件 (.test.ts/.test.tsx/.spec.ts/.spec.tsx). 测试描
      // 述里中英紧贴 / 测试 fixture 字符串都不是用户可见文案.
      if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 扫描
// ──────────────────────────────────────────────────────────────────────────
const files = listFiles(ROOT);
const errors = []; // 繁体 / 港台用词 (fail)
const warnings = []; // 中英文空格 (warn, 不 fail)

const TRAD_CHARS = Object.keys(TRADITIONAL_MAP).join('');
const TRAD_RE = new RegExp(`[${TRAD_CHARS}]`, 'g');

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  const content = stripEscapes(stripComments(rawContent));
  const relFile = relative(process.cwd(), file).replace(/\\/g, '/');

  // a) 繁体字
  for (const match of content.matchAll(TRAD_RE)) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (lineHasAllowComment(content, lineNum)) continue;
    const ch = match[0];
    errors.push({
      file: relFile,
      line: lineNum,
      kind: '繁体字',
      snippet: ch,
      suggestion: TRADITIONAL_MAP[ch],
    });
  }

  // b) 港台用词
  for (const { phrase, suggestion } of HK_TW_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    for (const match of content.matchAll(re)) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      if (lineHasAllowComment(content, lineNum)) continue;
      errors.push({
        file: relFile,
        line: lineNum,
        kind: '港台用词',
        snippet: phrase,
        suggestion,
      });
    }
  }

  // c) 中英文紧贴 (warning)
  for (const match of content.matchAll(CJK_ASCII_RE)) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (lineHasAllowComment(content, lineNum)) continue;
    warnings.push({
      file: relFile,
      line: lineNum,
      snippet: match[0],
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 输出
// ──────────────────────────────────────────────────────────────────────────
console.log(`Checking ${files.length} files...\n`);

for (const e of errors) {
  console.error(
    `✗ ${e.file}:${e.line}: ${e.kind} "${e.snippet}" — 推荐改 "${e.suggestion}"`
  );
}
for (const w of warnings) {
  console.warn(
    `W ${w.file}:${w.line}: 中英文紧贴 "${w.snippet}" — 推荐加空格`
  );
}

const errorCount = errors.length;
const warnCount = warnings.length;
const total = errorCount + warnCount;

if (total === 0) {
  console.log(`✓ No CN-simplified violations across ${files.length} files`);
  process.exit(0);
}

console.log(
  `\nFound ${total} violation(s) (${errorCount} error${errorCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'}) across ${files.length} files`
);

if (errorCount > 0) {
  console.error(
    `\n规则 (SIKAO 面向简体中文互联网用户):\n` +
      `  - 繁体字 (zh-Hant) → 简体字\n` +
      `  - 港台用词 (登入/登出/档案/软体/视讯/...) → 大陆用词\n` +
      `  - 中英文紧贴 (warning, 不 fail): 推荐加空格 "测试 ABC"\n` +
      `  - Escape hatch: 行尾 \`// cn-simplified-allow: <reason>\``
  );
  process.exit(1);
}

// 只有 warning, 不 fail
process.exit(0);
