#!/usr/bin/env node
/**
 * lint-radius-token.mjs — 巡检 Tailwind 默认 radius class 漏洞.
 *
 * CLAUDE.md §4 组件圆角 SSOT 铁律 + PR4 (Frontend Style Guide v1, 2026-05-12):
 *   - 白名单 7 档 token 值: 0 / 2 / 4 / 6 / 10 / 14 / 999 (px)
 *   - 白名单 token 名 / utility:
 *       rounded-1 (--r-1, 2px) / rounded-tiny (--r-tiny, 4px) /
 *       rounded-2 (--r-2, 6px) / rounded-card (--r-card, 10px) /
 *       rounded-card-lg (--r-card-lg, 14px) / rounded-pill (--r-pill, 999px) /
 *       rounded-full (dot pattern only, 见下文)
 *   - 禁: rounded-sm / rounded-md / rounded-lg / rounded-2xl / rounded-3xl
 *       (Tailwind 默认 + 跟项目 token 撕裂; legacy alias rounded-xl 当前由
 *       tailwind.config 重写, 等 marketing 清理后转禁)
 *
 * Legacy alias (PR2 期间过渡):
 *   - rounded-xs / rounded-chip / rounded-btn / rounded-xl 暂保留在 tailwind.config
 *     作为 alias → 等 PR2 grep-replace 完 + tailwind.config 删 key 后这些 class
 *     自然被 Tailwind 视为非法, build 会报. 本 lint 不主动禁 legacy alias,
 *     由 PR2 收尾兜底.
 *
 * 已有 `lint:hardcode` 巡检 `rounded-[Npx]` 任意值, 本 lint 补 Tailwind 默认值
 * 漏洞 (字符不同但数值可能巧合 → SSOT 撕裂).
 *
 * 例外:
 *   - rounded-full 在 dot pattern (元素显式宽高 ≤16px + `data-pattern="dot"` marker) 放过
 *   - 行尾 `// radius-allow: <reason>` 跳过本行 (跟 hardcode-allow 同款)
 *   - 测试目录 (__tests__ / __mocks__) 自动 skip
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:radius-token`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx', '.ts'];

// 禁 Tailwind 默认 (sm/md/lg/2xl/3xl/full). xl 暂走 tailwind.config 重写, PR5 后转禁.
const DEFAULT_RADIUS_RE = /\brounded(-[trbl]{1,2})?-(sm|md|lg|2xl|3xl|full)\b/g;

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*radius-allow:/;

// 允许 marker 在违规行 ±5 行范围内 (multi-line 模板字符串 className 场景: marker 通常
// 跟在表达式结束的 `}` 或 `` ` `` 后, 跨多行).
function hasNearbyAllowComment(lines, lineNum) {
  const lo = Math.max(1, lineNum - 5);
  const hi = Math.min(lines.length, lineNum + 5);
  for (let i = lo; i <= hi; i++) {
    if (lines[i - 1] && ALLOW_RE.test(lines[i - 1])) return true;
  }
  return false;
}

function isDotPattern(content, matchStart) {
  const windowStart = Math.max(0, matchStart - 200);
  const windowEnd = Math.min(content.length, matchStart + 200);
  const window = content.slice(windowStart, windowEnd);
  return /data-pattern=["']dot["']/.test(window);
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
  const matches = [...content.matchAll(DEFAULT_RADIUS_RE)];
  for (const match of matches) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    if (hasNearbyAllowComment(lines, lineNum)) continue;
    if (match[0].endsWith('-full') && isDotPattern(content, match.index)) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      snippet: match[0],
    });
  }
}

if (violations.length > 0) {
  console.error(
    `✗ ${violations.length} radius-default-class violation(s) found in ${files.length} files:\n`
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
  }
  console.error(
    `\n规则 (CLAUDE.md §4 + PR4 — Frontend Style Guide v1):\n` +
      `  - 禁 Tailwind 默认: rounded-sm / md / lg / 2xl / 3xl / full\n` +
      `  - 改用规范 token: rounded-1 (2) / rounded-tiny (4) / rounded-2 (6) / rounded-card (10) / rounded-card-lg (14) / rounded-pill (999)\n` +
      `  - Legacy alias (rounded-xs / chip / btn / xl) PR2 期间过渡保留, PR2 完成 + tailwind config 删 alias 后自然失效\n` +
      `  - 例外: dot pattern (≤16px + \`data-pattern="dot"\` marker) 放过\n` +
      `  - Escape hatch: 行尾 \`// radius-allow: <reason>\``
  );
  process.exit(1);
}

console.log(`✓ No radius-default-class violations across ${files.length} files`);
