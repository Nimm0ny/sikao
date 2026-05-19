#!/usr/bin/env node
/**
 * lint-practice-svg-only.mjs — 巡检答题系统 SVG-only 硬约束.
 *
 * CLAUDE.md §4 (lhr 2026-05-09 授权): 答题系统按钮 (practice / essay 答题流)
 * 必须用 SVG icon, 不允许 emoji 字符 (+ × ✓ etc.) / Tailwind 默认 / 任意值.
 *
 * 巡检范围: views/PracticeSession.tsx / views/Essay*.tsx + components/practice/**
 * + components/essay/** 路径下所有 <button> / <IconBtn> / role="button" 元素:
 *   (a) 必须含 <svg> 子节点 (SvgIcon component import 自 @/components/icons
 *       e.g. <NavSubmitIcon /> / <ActionPlusIcon /> 视为 svg)
 *   (b) 不允许直接 textContent 仅含 CJK 字符或 ASCII 编辑符号 ('+' / '×' / '✓')
 *       作为图标语义
 *   (c) 必须带 aria-label 属性
 *
 * 主 CTA 例外: SVG-only 但允许伴随文字 (e.g. <NavSubmitIcon /> + 文字 "提交"
 * 双形态). 这种 button 必须紧邻 `svg-only-allow:` 明确登记.
 *
 * 例外:
 *   - 行尾 / 紧邻行 `// svg-only-allow: <reason>` 跳过本元素 (跟 hardcode-allow 同款)
 *   - 测试目录 (__tests__ / __mocks__) 自动 skip
 *   - <button type="submit"> 在 form 内不强制 (form 提交语义, 走 form a11y)
 *
 * 实现思路: 用 fs walker (lint-italic.mjs / lint-radius-token.mjs 同款) +
 * regex 抓 <button / <IconBtn 起始, 解析到对应 closing tag, 检查内容. 不真解析
 * JSX AST (引 babel parser 太重). primary 防线是 master agent + subagent review.
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:practice-svg-only`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx'];

// 巡检路径白名单 (相对 src/)
const TARGET_PREFIXES = [
  'components/practice/',
  'components/essay/',
  'components/icons/composite/',
  'components/result/',
  'features/essay-exam/',
  'views/practicesession',
  'views/essay',
  'views/result',
];

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*svg-only-allow:/;

// emoji icon 字符 (CLAUDE.md §4 — 不允许 emoji 当 UI 图标; 单独 ascii 符号
// '+' '×' '✓' 等当图标也违规, 必须用对应 SVG icon)
const ICON_GLYPH_RE = /^[\s+×✓✗→←↑↓·•※]+$/;

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
      !full.endsWith('.spec.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

function inTargetPath(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/').toLowerCase();
  return TARGET_PREFIXES.some((p) => rel.startsWith(p));
}

// 把 `/* ... */` 块注释 / `// ...` 行注释 / `{/* ... */}` JSX 注释替换成等长空白,
// 让 regex 不在注释里命中. 保留长度让 lineNum / matchStart 偏移不变.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

// 找到对应 closing tag (考虑嵌套). 给定开始标签起点 + tag name, 返回 closing 后的位置.
function findCloseTag(content, openTagEnd, tagName) {
  // openTagEnd 是 `>` 之后的位置. 从这里开始扫.
  let depth = 1;
  let i = openTagEnd;
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'g');
  while (i < content.length && depth > 0) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const openMatch = openRe.exec(content);
    const closeMatch = closeRe.exec(content);
    if (!closeMatch) return -1;
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      i = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) return closeMatch.index;
      i = closeMatch.index + closeMatch[0].length;
    }
  }
  return -1;
}

// 检查紧邻行 (±3 行) 有没有 svg-only-allow marker
function getNearbyAllowComment(rawLines, lineNum) {
  const lo = Math.max(1, lineNum - 3);
  const hi = Math.min(rawLines.length, lineNum + 3);
  for (let i = lo; i <= hi; i++) {
    const line = rawLines[i - 1];
    if (line && ALLOW_RE.test(line)) return line;
  }
  return null;
}

function hasNearbyAllowComment(rawLines, lineNum) {
  return getNearbyAllowComment(rawLines, lineNum) !== null;
}

// Tag 启动 regex: <button | <IconBtn | any JSX/HTML element with role="button".
const TAG_RE = /<(button|IconBtn)\b|<([A-Za-z][A-Za-z0-9.]*)\b(?=[^>]*\brole\s*=\s*["']button["'])/g;
const BUTTON_COMPONENT_RE = /<Button\b/g;

// 提取 tag 自身的属性区间, 解析特定 attribute 是否存在
function extractAttrs(content, tagStart) {
  // 找到 `>` 终止 (tag self-close 或 普通结束)
  // 跳过:
  //   - string 字面量内的 '>' (e.g. aria-label="跳到 > 下一题")
  //   - template literal `...` 内的 '>'
  //   - JSX 表达式 {...} 内的 '>' (含箭头函数 () => x, 模板表达式 ${...} 等)
  let i = tagStart + 1; // skip opening '<'
  let inStr = null; // '"' | "'" | '`' | null
  let braceDepth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (inStr) {
      // template literal expression `${...}` — string-aware scan
      if (inStr === '`' && ch === '$' && content[i + 1] === '{') {
        braceDepth++;
        i += 2;
        continue;
      }
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === inStr && braceDepth === 0) inStr = null;
      else if (ch === '}' && braceDepth > 0) braceDepth--;
    } else if (braceDepth > 0) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '{') braceDepth++;
      else if (ch === '>') {
        return {
          attrText: content.slice(tagStart, i),
          tagEnd: i + 1,
          selfClose: content[i - 1] === '/',
        };
      }
    }
    i++;
  }
  return { attrText: '', tagEnd: -1, selfClose: false };
}

function hasAttr(attrText, name) {
  // 简单 attribute 检测 — name="..." / name={...} / name 单独 (boolean)
  // 不含 string 内的伪命中: extractAttrs 已用 string-aware scan, 这里 attrText
  // 保留原文, 但 name="..." 匹配通常足够.
  const re = new RegExp(`(?<![\\w-])${name}\\s*=`);
  return re.test(attrText);
}

// 检查 tag 内容是否含 svg 子节点 (任何 <svg ...> 或 <Xxx ... 大写 component
// import 自 @/components/icons 视为 svg primitive)
const ICON_COMPONENT_RE = /<(?:[A-Z][A-Za-z0-9]*Icon|svg)\b/;
const NUMBER_CIRCLE_RE = /<NumberCircle\b/; // dock 的题号格
const MAIN_CTA_ALLOW_RE = /svg-only-allow:\s*(?:main-cta|dialog|modal)\b/i;

function bodyHasSvg(body) {
  return ICON_COMPONENT_RE.test(body) || NUMBER_CIRCLE_RE.test(body);
}

function bodyHasAllowedInjectedIcon(body, allowComment) {
  return allowComment !== null && /\{\s*children\s*\}/.test(body);
}

// 提取 button body 的纯 textContent. JSX tag 本身不算文本, 但 children
// 字面量必须保留, 否则 `<span>答题卡</span>` 会被整段删掉形成假阴性.
function extractText(body) {
  const withoutExpressions = body.replace(/\{[^{}]*\}/g, ' ');
  const withoutSelfClosingTags = withoutExpressions.replace(/<[A-Za-z][^<>]*\/>/g, ' ');
  const withoutTags = withoutSelfClosingTags.replace(/<\/?[A-Za-z][^<>]*>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
}

function hasCjkText(text) {
  return /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/u.test(text);
}

function findBlockEnd(src, openBraceIndex) {
  let depth = 1;
  let i = openBraceIndex + 1;
  let inStr = null;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function findCjkStringReturningFunctions(src) {
  const names = new Set();
  const functionRe = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)[^{]*\{/g;
  let match = functionRe.exec(src);
  while (match) {
    const openBraceIndex = functionRe.lastIndex - 1;
    const closeBraceIndex = findBlockEnd(src, openBraceIndex);
    if (closeBraceIndex !== -1) {
      const body = src.slice(openBraceIndex + 1, closeBraceIndex);
      if (/\breturn\s+(?:`[^`]*[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef][^`]*`|['"][^'"]*[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef][^'"]*['"])/u.test(body)) {
        names.add(match[1]);
      }
      functionRe.lastIndex = closeBraceIndex + 1;
    }
    match = functionRe.exec(src);
  }
  return names;
}

function findCjkStringExpressionVariables(src, cjkFunctions) {
  const names = new Set();
  for (const fn of cjkFunctions) {
    const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const assignmentRe = new RegExp(
      `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escaped}\\s*\\(`,
      'g',
    );
    let match = assignmentRe.exec(src);
    while (match) {
      names.add(match[1]);
      match = assignmentRe.exec(src);
    }
  }
  return names;
}

function bodyHasCjkExpression(body, cjkFunctions, cjkVariables) {
  const expressionRe = /\{\s*([A-Za-z_$][\w$]*)\s*(?:\([^{}]*\))?\s*\}/g;
  let match = expressionRe.exec(body);
  while (match) {
    const name = match[1];
    if (cjkVariables.has(name) || cjkFunctions.has(name)) return name;
    match = expressionRe.exec(body);
  }
  return null;
}

function runInternalAssertions() {
  if (!inTargetPath(join(ROOT, 'views', 'result', 'ResultMobile.tsx'))) {
    throw new Error(
      'lint-practice-svg-only internal assertion failed: views/result/ResultMobile.tsx was not included in target paths',
    );
  }

  const nestedSpanBody = `
    <PanelLeftOpenIcon className="w-4 h-4" />
    <span>
      点击查看
      <br />
      给定资料
    </span>
  `;
  const nestedSpanText = extractText(nestedSpanBody);
  if (nestedSpanText !== '点击查看 给定资料' || !hasCjkText(nestedSpanText)) {
    throw new Error(
      `lint-practice-svg-only internal assertion failed: nested span text was not detected (${nestedSpanText})`,
    );
  }

  const cjkFunctions = findCjkStringReturningFunctions(`
    function metaText(status) {
      if (status === 'pending') return '未读';
      return \`已读\`;
    }
    const meta = metaText(status);
  `);
  const cjkVariables = findCjkStringExpressionVariables(
    'const meta = metaText(status);',
    cjkFunctions,
  );
  const expressionName = bodyHasCjkExpression('<svg />{meta}', cjkFunctions, cjkVariables);
  if (expressionName !== 'meta') {
    throw new Error(
      `lint-practice-svg-only internal assertion failed: CJK expression source was not detected (${expressionName})`,
    );
  }
}

function isRoleButton(attrText) {
  return /\brole\s*=\s*["']button["']/.test(attrText);
}

function shouldCheckTag(tagName, attrText) {
  return tagName === 'button' || tagName === 'IconBtn' || isRoleButton(attrText);
}

function isAllowedSvgText(allowComment) {
  return allowComment !== null && MAIN_CTA_ALLOW_RE.test(allowComment);
}

const files = listFiles(ROOT).filter(inTargetPath);
const violations = [];
runInternalAssertions();
// 加严规则 (c) — file-level lucide-react import 走 warning (非阻塞).
// fix-A 完成 9 处之外仍有 lucide imports 散布, 走"临时过度政策": 抓出来打印 ⚠️,
// 等后续 sweep 把 lucide-react 全清后改成 hard-fail.
const lucideWarnings = [];

// 加严规则 (2026-05-09 fix-C 加严): lucide-react import 在 practice / essay
// 答题流路径下一律不允许. lucide-react component (<X /> / <Check /> / <Flag />)
// 不命中 ICON_COMPONENT_RE (没 Icon 后缀), fix-A 的 button-level 检测会漏掉 —
// 把规则提到 file-level: 路径在 TARGET_PREFIXES 范围内 + 文件 import 'lucide-react'
// 即触发 warning, 强制改 components/icons/* SIKAO svg primitive 或 inline <svg>.
//
// 当前为 warning (临时过度政策). 等 lucide-react 在 practice / essay 全清后,
// 把 lucideWarnings 合入 violations + exit 1.
//
// 例外: 行尾 `// svg-only-allow: <reason>` (跟 button-level 同款 escape hatch)
const LUCIDE_IMPORT_RE = /^\s*import\s+[^;]*from\s+['"]lucide-react['"]/m;

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  const rawLines = rawContent.split('\n');
  const content = stripComments(rawContent);
  const cjkFunctions = findCjkStringReturningFunctions(content);
  const cjkVariables = findCjkStringExpressionVariables(content, cjkFunctions);

  // file-level: lucide-react import (跑前的 stripComments 防注释里 import 误抓)
  const lucideMatch = LUCIDE_IMPORT_RE.exec(content);
  if (lucideMatch) {
    const lucideLineNum =
      content.slice(0, lucideMatch.index).split('\n').length +
      content
        .slice(lucideMatch.index, lucideMatch.index + lucideMatch[0].length)
        .split('\n').length -
      1;
    if (!hasNearbyAllowComment(rawLines, lucideLineNum)) {
      lucideWarnings.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lucideLineNum,
      });
    }
  }

  const matches = [...content.matchAll(TAG_RE)];

  for (const match of matches) {
    const tagStart = match.index;
    const tagName = match[1] ?? match[2];
    const lineNum = content.slice(0, tagStart).split('\n').length;
    const allowComment = getNearbyAllowComment(rawLines, lineNum);

    const { attrText, tagEnd, selfClose } = extractAttrs(content, tagStart);
    if (tagEnd === -1) continue;
    if (!shouldCheckTag(tagName, attrText)) continue;

    // self-closing button (rare but possible) 没 children → skip
    // (TS 上 button 必须 closing, 但 IconBtn 偶尔 self-close)
    let body = '';
    if (!selfClose) {
      const closeStart = findCloseTag(content, tagEnd, tagName);
      if (closeStart === -1) continue;
      body = content.slice(tagEnd, closeStart);
    }

    // 跳过 form submit button 的 type="submit" 容器外的 form-button — 这个 lint
    // 严格只看是否有 svg + aria-label, type="submit" 在 form 内通常允许文字.
    // 但本批次需求是答题工具按钮, form 内 submit 也走 svg-only (FbScratchCol /
    // ScratchPad 已修). 不做 type="submit" 例外.

    // 检查 1: body 是否含 svg 子节点
    const hasSvg = bodyHasSvg(body) || bodyHasAllowedInjectedIcon(body, allowComment);

    // 检查 2: 是否仅 emoji/ASCII glyph (如 '+' '×')
    const text = extractText(body);
    const onlyGlyph = text !== '' && ICON_GLYPH_RE.test(text);
    const cjkExpression = bodyHasCjkExpression(body, cjkFunctions, cjkVariables);

    // 检查 3: 是否有 aria-label
    const hasAriaLabel = hasAttr(attrText, 'aria-label');
    const hasNativeTitle = hasAttr(attrText, 'title');

    const hasAllowedSvgText = isAllowedSvgText(allowComment);
    const isViolation =
      !hasSvg ||
      onlyGlyph ||
      (hasSvg && hasCjkText(text) && !hasAllowedSvgText) ||
      (hasSvg && cjkExpression !== null && !hasAllowedSvgText);

    if (isViolation) {
      const reason = onlyGlyph
        ? `glyph-as-icon ("${text}")`
        : !hasSvg
          ? 'no-svg-child'
          : cjkExpression !== null
            ? `svg-text-expression-without-allow ({${cjkExpression}})`
            : `svg-text-without-allow ("${text}")`;
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        tag: tagName,
        reason,
      });
    }

    // 副检查: 有 svg 但缺 aria-label (a11y 漏洞). 严格.
    if (hasSvg && !hasAriaLabel && !isViolation) {
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        tag: tagName,
        reason: 'missing-aria-label',
      });
    }

    if (hasNativeTitle) {
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        tag: tagName,
        reason: 'native-title-attribute',
      });
    }
  }

  for (const match of content.matchAll(BUTTON_COMPONENT_RE)) {
    const tagStart = match.index;
    const lineNum = content.slice(0, tagStart).split('\n').length;
    const allowComment = getNearbyAllowComment(rawLines, lineNum);
    if (allowComment !== null) continue;
    const { attrText, tagEnd } = extractAttrs(content, tagStart);
    if (tagEnd === -1) continue;
    if (!hasAttr(attrText, 'title')) continue;
    violations.push({
      file: relative(process.cwd(), file).replace(/\\/g, '/'),
      line: lineNum,
      tag: 'Button',
      reason: 'native-title-attribute',
    });
  }
}

if (lucideWarnings.length > 0) {
  console.error(
    `\n✗ ${lucideWarnings.length} lucide-react import(s) in practice/result/essay paths:\n`,
  );
  for (const w of lucideWarnings) {
    console.error(`  ${w.file}:${w.line}  lucide-react-import`);
  }
  violations.push(
    ...lucideWarnings.map((w) => ({
      file: w.file,
      line: w.line,
      tag: 'import',
      reason: 'lucide-react-import',
    })),
  );
}

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} practice/result/essay svg-only violation(s) found in ${files.length} files:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  <${v.tag}> ${v.reason}`);
  }
  console.error(
    `\n规则 (CLAUDE.md §4 SVG-only 答题按钮硬约束, 2026-05-09 lhr 授权):\n` +
      `  - practice / essay 答题流的 <button> / <IconBtn> 必须含 svg 子节点\n` +
      `  - role="button" 元素按 button 同规则巡检\n` +
      `  - 不允许 emoji / ASCII glyph (+ × ✓ → ←) 当 icon, 改用 components/icons/*Icon\n` +
      `  - 必须带 aria-label 属性\n` +
      `  - 主 CTA / dialog 双形态 ([svg + 文字]) 必须紧邻 \`svg-only-allow: main-cta|dialog|modal\`\n` +
      `  - lucide-react import 在 practice / essay 路径禁止; 改 components/icons/* SIKAO svg primitive 或 inline <svg>\n` +
      `  - 修法: 用 ActionPlusIcon / NavSubmitIcon / ToolEyeIcon 等 svg primitive\n` +
      `  - Escape hatch: 紧邻行 \`// svg-only-allow: <reason>\``,
  );
  process.exit(1);
}

console.log(
  `✓ No practice/essay svg-only violations across ${files.length} files` +
    (lucideWarnings.length > 0
      ? ` (${lucideWarnings.length} lucide-react warning(s) listed above)`
      : ''),
);
