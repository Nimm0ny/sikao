#!/usr/bin/env node
/**
 * lint-icon-button.mjs — 巡检 SVG-only button / IconBtn 的 aria-label 漏洞.
 *
 * docs/plan/frontend-style-guide-v1-migration.md §4 PR4 + CLAUDE.md §4 (a11y):
 *   - `<button>` 子节点仅含 `<svg>` / `<Icon*>` / `<IconBtn>` / `<I[A-Z]*>` 等图标
 *     组件 (无可见文字), 必须显式 aria-label / aria-labelledby
 *   - `<IconBtn>` / `<IconButton>` primitive: 必须有 aria-label / aria-labelledby
 *
 * 实现思路: regex 抓 <button | <IconBtn | <IconButton 起始标签, 解析 attrText +
 * children, 复用 lint-practice-svg-only.mjs 的 string-aware extractAttrs +
 * findCloseTag, 但只检 a11y, 不检 svg 完整性 (那个 lint 已存在, 范围更窄).
 *
 * 范围: frontend/src/**∕*.tsx (含 views / components / hooks / lib / layouts / brand …)
 *   排除: __tests__ / __mocks__ / *.test.tsx / *.spec.tsx / *.stories.tsx
 *
 * Escape hatch:
 *   - 行尾 / 紧邻行 `// icon-button-allow: <reason>` 跳过当前元素
 *   - 文件级 `/* icon-button-allow-file: <reason> *∕` 跳过整文件 (注释里写, 必须给理由)
 *
 * 跨平台 (Node.js 内置 fs). 使用: `npm run lint:icon-button`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', 'src');
const EXTS = ['.tsx'];

const ALLOW_RE = /(?:\/\/|\/\*|\{\/\*)\s*icon-button-allow:/;
const ALLOW_FILE_RE = /(?:\/\/|\/\*|\{\/\*)\s*icon-button-allow-file:/;

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

// 把 `/* ... */` 块注释 / `// ...` 行注释 / `{/* ... */}` JSX 注释替换成等长空白
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '));
}

// String-aware tag attribute scanner — 复用 lint-practice-svg-only 同款逻辑
function extractAttrs(content, tagStart) {
  let i = tagStart + 1;
  let inStr = null;
  let braceDepth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (inStr) {
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

function findCloseTag(content, openTagEnd, tagName) {
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

function getNearbyAllowComment(rawLines, lineNum) {
  const lo = Math.max(1, lineNum - 3);
  const hi = Math.min(rawLines.length, lineNum + 3);
  for (let i = lo; i <= hi; i++) {
    const line = rawLines[i - 1];
    if (line && ALLOW_RE.test(line)) return line;
  }
  return null;
}

function hasAttr(attrText, name) {
  const re = new RegExp(`(?<![\\w-])${name}\\s*=`);
  return re.test(attrText);
}

// 提取 button body 的纯 textContent (剔除 tag + 表达式)
function extractText(body) {
  const withoutExpressions = body.replace(/\{[^{}]*\}/g, ' ');
  const withoutSelfClosingTags = withoutExpressions.replace(/<[A-Za-z][^<>]*\/>/g, ' ');
  const withoutTags = withoutSelfClosingTags.replace(/<\/?[A-Za-z][^<>]*>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
}

// 检测 body 是否含**非图标表达式** {xxx}.
// SVG-only button 的典型形态: 子节点全是 <SvgIcon /> 或 {iconExpr} 这种图标 expression.
// 含 {title} / {label} / {entry.label} / {meta} 等非图标表达式 → 假定渲染文本,
// 不当 SVG-only 判定 (避免 lint 误报 NavRow / TitleRow 等含动态文本的 button).
//
// 规则:
//   - {Icon} / {icon} / {iconExpr} (大写或 icon 关键字) → 视为图标表达式 (skip)
//   - 其它 {xxx} (label / title / meta / children / props.label …) → 视为文本表达式
//   - {/* comment */} 已被 stripComments 处理
function bodyHasTextExpression(body) {
  const exprRe = /\{([^{}]+)\}/g;
  let match;
  while ((match = exprRe.exec(body)) !== null) {
    const inner = match[1].trim();
    // 跳过空表达式 (理论上不存在, 防御)
    if (inner === '') continue;
    // 跳过 JSX spread {...rest}
    if (inner.startsWith('...')) continue;
    // 图标 expression heuristic — 名称包含 'icon' / 'Icon' / 大写开头单一标识符
    // (e.g. <Icon>, <BrandIcon>, {icon}, {Icon}, {entry.icon})
    const looksLikeIconExpr =
      /\b[iI]con\b/.test(inner) ||
      /^<\s*[A-Z]/.test(inner); // <SvgIcon /> 表达式
    if (looksLikeIconExpr) continue;
    // 其它 — 视为文本表达式
    return true;
  }
  return false;
}

// body 是否含 svg / Icon* 子节点 (本 lint 视为图标 — 跟 practice-svg-only 同款规则)
//   - <svg ...>
//   - <Xxx Icon ...> 大写命名约定 (e.g. NavSubmitIcon / ActionPlusIcon)
//   - <I[A-Z]...> 单字符 I + 大写 命名约定 (e.g. <IClose />)
const ICON_COMPONENT_RE = /<(?:svg|[A-Z][A-Za-z0-9]*Icon|I[A-Z][A-Za-z0-9]*)\b/;
function bodyHasIcon(body) {
  return ICON_COMPONENT_RE.test(body);
}

// Tag 启动 regex: <button | <IconBtn | <IconButton.
const TAG_RE = /<(button|IconBtn|IconButton)\b/g;

const files = listFiles(ROOT);
const violations = [];

for (const file of files) {
  const rawContent = readFileSync(file, 'utf8');
  if (ALLOW_FILE_RE.test(rawContent)) continue;
  const rawLines = rawContent.split('\n');
  const content = stripComments(rawContent);

  const matches = [...content.matchAll(TAG_RE)];

  for (const match of matches) {
    const tagStart = match.index;
    const tagName = match[1];
    const lineNum = content.slice(0, tagStart).split('\n').length;
    const allowComment = getNearbyAllowComment(rawLines, lineNum);
    if (allowComment !== null) continue;

    const { attrText, tagEnd, selfClose } = extractAttrs(content, tagStart);
    if (tagEnd === -1) continue;

    const hasAriaLabel = hasAttr(attrText, 'aria-label');
    const hasAriaLabelledBy = hasAttr(attrText, 'aria-labelledby');
    // IconBtn primitive 约定: `label` prop 内部转 aria-label.
    // 接受 label="..." 当 aria-label 等价物 (合 components/ui/IconBtn + SessionHeader
    // 内 file-local IconButton 等命名约定).
    const hasLabelProp = hasAttr(attrText, 'label');

    // IconBtn / IconButton primitive — 强制要 aria-label / aria-labelledby / label
    if (tagName === 'IconBtn' || tagName === 'IconButton') {
      if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabelProp) {
        violations.push({
          file: relative(process.cwd(), file).replace(/\\/g, '/'),
          line: lineNum,
          tag: tagName,
          reason: 'missing-aria-label',
        });
      }
      continue;
    }

    // <button> — 必须有 children 才检 (self-close 不可能, 但保险跳过)
    if (selfClose) continue;
    const closeStart = findCloseTag(content, tagEnd, tagName);
    if (closeStart === -1) continue;
    const body = content.slice(tagEnd, closeStart);

    // 跳过 type="submit" 在 form 内 — 由 form 语义提供 a11y (此 lint 范围是 icon-only)
    // (但若 submit button 内仅 svg 还是不合理, 这里更严: type="submit" + 仅 svg + 无 aria → 报)
    const text = extractText(body);
    const hasIcon = bodyHasIcon(body);
    const hasTextExpr = bodyHasTextExpression(body);

    // 只检 SVG-only (无文本) button 的 aria-label 漏洞.
    //   - 有 icon + 无文字 (literal + expression) + 无 aria-label/labelledby → 违规
    //   - 有 icon + 有可见文字 (literal text 或 文本 expression) → 视为合规
    //   - 无 icon → 跳过本 lint (走 jsx-a11y control-has-associated-label 等其他规则)
    if (
      hasIcon &&
      text === '' &&
      !hasTextExpr &&
      !hasAriaLabel &&
      !hasAriaLabelledBy
    ) {
      violations.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: lineNum,
        tag: tagName,
        reason: 'svg-only-button-missing-aria-label',
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ ${violations.length} icon-button a11y violation(s) found in ${files.length} files:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  <${v.tag}> ${v.reason}`);
  }
  console.error(
    `\n规则 (PR4 — Frontend Style Guide v1 a11y):\n` +
      `  - <button> 内只有 svg/Icon* 子节点且无文字 → 必须有 aria-label / aria-labelledby\n` +
      `  - <IconBtn> / <IconButton> → 必须有 aria-label / aria-labelledby\n` +
      `  - 修法: 加 aria-label="<中文动作>" (e.g. aria-label="关闭")\n` +
      `  - Escape hatch: 紧邻行 \`// icon-button-allow: <reason>\` 或 file-level \`/* icon-button-allow-file: <reason> */\``,
  );
  process.exit(1);
}

console.log(`✓ No icon-button violations across ${files.length} files`);
