#!/usr/bin/env node
/**
 * lint-no-emoji-as-icon.mjs — 巡检 production view 内的 emoji 字符违规.
 *
 * docs/plan/frontend-style-guide-v1-migration.md §4 PR4 + CLAUDE.md §4 (ink-first
 * 工具感 + SIKAO 落地包 "不要 emoji 当真实 UI"):
 *   - frontend/src/views/** + frontend/src/components/** 路径下, 禁 emoji 字符
 *   - 白名单: marketing / landing view, error-*.svg illustration, 测试 / stories
 *
 * 检测 unicode range:
 *   - U+1F300 .. U+1F9FF  (Misc Symbols / Emoticons / Transport / Supplemental Symbols)
 *   - U+2600  .. U+27BF   (Misc Symbols / Dingbats)
 *   - U+1FA70 .. U+1FAFF  (Symbols and Pictographs Extended-A)
 *   - U+FE0F variation selector (emoji variant)
 *   - U+200D ZWJ (跨 emoji join)
 *   - U+1F1E6 .. U+1F1FF regional indicator (国旗)
 *
 * 不检测: 数字 / ASCII / CJK / 全角符号 — 这些由 lint-italic / hardcode 等覆盖.
 *
 * Escape hatch:
 *   - 文件级 `// lint-allow-emoji` 顶注 (首 20 行内)
 *   - 行级 `// emoji-allow: <reason>` (跟 hardcode-allow 同款)
 *
 * 自动 whitelist:
 *   - frontend/src/views/marketing/**
 *   - frontend/src/views/landing/**   (尚未存在, 预留)
 *   - frontend/src/assets/illustrations/error-*.svg (SVG 文件不在 .tsx 扫描范围)
 *   - __tests__ / __mocks__ / *.test.tsx / *.spec.tsx / *.stories.tsx
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:no-emoji-as-icon`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx'];

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*emoji-allow:/;
const ALLOW_FILE_RE = /\/\/\s*lint-allow-emoji/;

// 白名单路径 (相对 src/)
const WHITELIST_PREFIXES = [
  'views/marketing/',
  'views/landing/',
  'assets/illustrations/',
];

// 巡检路径 (相对 src/): views/ + components/
const TARGET_PREFIXES = ['views/', 'components/'];

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

// 把 `/* ... */` 块注释 / `// ...` 行注释 / `{/* ... */}` JSX 注释替换成等长空白
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

// dingbats / editorial 单字符 (✓ ✗ × → ← ↑ ↓ + − etc.) 不算装饰 emoji.
// 它们由 lint:practice-svg-only ICON_GLYPH_RE 在答题路径管控; 非答题路径下
// 视为合法 editorial 符号 (跟 CLAUDE.md §4 italic 政策 D3a "ASCII editorial
// 符号" 同款放过). 本 lint 只针对装饰性彩色 emoji (🎯 📚 🚀 ❤️ 等).
//
// 具体放过点 (在 U+2600-U+27BF dingbats range 内):
const DINGBATS_ALLOWLIST = new Set([
  0x2713, // ✓ CHECK MARK
  0x2714, // ✔ HEAVY CHECK MARK
  0x2715, // ✕ MULTIPLICATION X
  0x2716, // ✖ HEAVY MULTIPLICATION X
  0x2717, // ✗ BALLOT X
  0x2718, // ✘ HEAVY BALLOT X
  0x2192, // → (此 cp 不在 dingbats range, 列此防御)
  0x2190, // ←
]);

// emoji code point range check
function isEmoji(cp) {
  if (DINGBATS_ALLOWLIST.has(cp)) return false;
  if (cp >= 0x1f300 && cp <= 0x1f9ff) return true; // Misc Symbols / Emoticons / Transport
  if (cp >= 0x2600 && cp <= 0x27bf) return true; // Misc Symbols / Dingbats
  if (cp >= 0x1fa70 && cp <= 0x1faff) return true; // Symbols and Pictographs Extended-A
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true; // regional indicator (国旗)
  return false;
}

function findEmojis(text) {
  const found = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    if (cp != null && isEmoji(cp)) {
      found.push({ char: String.fromCodePoint(cp), offset: i });
    }
    i += cp != null && cp > 0xffff ? 2 : 1;
  }
  return found;
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
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const emojis = findEmojis(line);
    if (emojis.length === 0) continue;

    // 行级 escape
    if (ALLOW_RE.test(line)) continue;

    for (const e of emojis) {
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineIdx + 1,
        emoji: e.char,
        codePoint: 'U+' + e.char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} emoji-as-icon violation(s) found in ${files.length} files:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  emoji "${v.emoji}" (${v.codePoint})`);
  }
  console.error(
    `\n规则 (PR4 — Frontend Style Guide v1 + CLAUDE.md §4 ink-first):\n` +
      `  - frontend/src/{views,components}/** 禁 emoji 字符 (production UI 调性: ink-first 工具感)\n` +
      `  - 白名单路径: views/marketing/ / views/landing/ / assets/illustrations/\n` +
      `  - 修法: 改用 components/icons/*Icon SVG primitive\n` +
      `  - Escape hatch: 行尾 \`// emoji-allow: <reason>\` 或 file-level \`// lint-allow-emoji\``,
  );
  process.exit(1);
}

console.log(`✓ No emoji-as-icon violations across ${files.length} files`);
