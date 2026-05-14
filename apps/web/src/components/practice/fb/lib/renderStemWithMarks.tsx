import type { ReactNode } from 'react';
import DOMPurify from 'dompurify';
import type { HighlightColorKey, Mark } from '@sikao/domain/xingce/useHighlightStore';

// P5b/2 题干 highlight 渲染 util (SIKAO 答题系统行测).
//
// 把 sanitized stem HTML + marks[] → ReactNode[], 让 React 可控渲染 <mark>
// 而不破 sanitize chain. 自写 text walker 避 html-react-parser 新依赖.
//
// 算法:
//   1. DOMPurify.sanitize(html) → safe HTML
//   2. DOMParser('text/html') → 文档树
//   3. 收集所有 text node + 累积 textIndex (跟 highlightRange.serializeSelection
//      算法对偶: Range.cloneRange + selectNodeContents + setEnd + toString().length)
//   4. 按 marks (sorted by textStart) 切片插 <mark data-c=... class="fb-hl">
//      包覆相交 text node 区间. 跨 text node 的 mark 拆多段保 wrap.
//   5. 输出 ReactNode[] (复用 React key 走 stable textIndex 偏移).
//
// 关键约束:
//   - 不破 sanitize chain (sanitize 在 parse 之前)
//   - 不破 React reconciler (ReactNode[], 不是 string)
//   - mark 不嵌套 mark (按 SPEC §5 单层)
//   - 跨 inline element (e.g. <em>...</em>) 的 mark 仍 wrap 正确 — 因为按
//     text node 切片, inline element 内 text node 单独切.

interface WalkContext {
  /** 当前累积 textIndex offset (跟 selectionOffsets 同语义). */
  textCursor: number;
  /** 输出 ReactNode 列表 (按 DOM 树顺序). */
  output: ReactNode[];
  /** marks sorted by textStart asc. */
  marks: readonly Mark[];
  /** 全局 key 计数器 (跨节点稳定 unique). */
  keyCounter: { value: number };
}

/**
 * Walk text node — 按 marks 切 substring → 包 <mark> / 不包 plain text.
 * 输出附加到 ctx.output. 更新 ctx.textCursor.
 */
function walkTextNode(node: Text, ctx: WalkContext): void {
  const text = node.textContent ?? '';
  if (text.length === 0) return;
  const segStart = ctx.textCursor;
  const segEnd = segStart + text.length;
  // 找跟 [segStart, segEnd) 相交的 marks
  const intersecting = ctx.marks.filter((m) => {
    const mStart = m.textStart;
    const mEnd = m.textStart + m.textLength;
    return mStart < segEnd && mEnd > segStart;
  });
  if (intersecting.length === 0) {
    ctx.output.push(text);
    ctx.textCursor = segEnd;
    return;
  }
  // 切片: 按 marks 的 break point (start / end) 排序去重得 cut points,
  // 然后每段决定是否 wrap.
  const cuts = new Set<number>([segStart, segEnd]);
  intersecting.forEach((m) => {
    cuts.add(Math.max(m.textStart, segStart));
    cuts.add(Math.min(m.textStart + m.textLength, segEnd));
  });
  const sortedCuts = Array.from(cuts).sort((a, b) => a - b);
  for (let i = 0; i < sortedCuts.length - 1; i += 1) {
    const sliceStart = sortedCuts[i];
    const sliceEnd = sortedCuts[i + 1];
    if (sliceEnd <= sliceStart) continue;
    const sliceText = text.slice(sliceStart - segStart, sliceEnd - segStart);
    if (sliceText.length === 0) continue;
    const coveringMark = pickCoveringMark(intersecting, sliceStart, sliceEnd);
    if (coveringMark === null) {
      ctx.output.push(sliceText);
    } else {
      const key = `fb-hl-${ctx.keyCounter.value}`;
      ctx.keyCounter.value += 1;
      ctx.output.push(
        <mark
          key={key}
          className="fb-hl"
          data-c={coveringMark.colorKey satisfies HighlightColorKey}
          data-mark-id={coveringMark.id}
          data-testid={`fb-mark-${coveringMark.id}`}
        >
          {sliceText}
        </mark>,
      );
    }
  }
  ctx.textCursor = segEnd;
}

/**
 * 切片 [sliceStart, sliceEnd) 内最先覆盖的 mark (按 createdAt asc 决定 z-order;
 * SPEC §5 单层 mark, 后续可改 "新覆盖旧" 但当前先保 stable).
 */
function pickCoveringMark(
  marks: readonly Mark[],
  sliceStart: number,
  sliceEnd: number,
): Mark | null {
  for (const m of marks) {
    const mStart = m.textStart;
    const mEnd = m.textStart + m.textLength;
    if (mStart <= sliceStart && mEnd >= sliceEnd) return m;
  }
  return null;
}

/**
 * Walk element node — 包元素 + 递归子节点. 元素本身不算 textIndex.
 */
function walkElement(node: Element, ctx: WalkContext): void {
  const children: ReactNode[] = [];
  const childCtx: WalkContext = {
    ...ctx,
    output: children,
  };
  walkChildren(node, childCtx);
  ctx.textCursor = childCtx.textCursor;
  const key = `fb-el-${ctx.keyCounter.value}`;
  ctx.keyCounter.value += 1;
  // 用 createElement-like JSX 复刻元素 + 子节点.
  // 只支持 sanitize 通过的常见 inline tags (em/strong/u/sub/sup/br/span).
  // 其它 tag 走 fallback span (DOMPurify 限制后 tag 集已可控).
  const tag = node.tagName.toLowerCase();
  // 取 element 上的属性 (sanitize 过, 通常只有 class / style).
  const className = node.getAttribute('class') ?? undefined;
  switch (tag) {
    case 'br':
      ctx.output.push(<br key={key} />);
      break;
    case 'em':
      ctx.output.push(
        <em key={key} className={className}>
          {children}
        </em>,
      );
      break;
    case 'strong':
    case 'b':
      ctx.output.push(
        <strong key={key} className={className}>
          {children}
        </strong>,
      );
      break;
    case 'u':
      ctx.output.push(
        <u key={key} className={className}>
          {children}
        </u>,
      );
      break;
    case 'sub':
      ctx.output.push(
        <sub key={key} className={className}>
          {children}
        </sub>,
      );
      break;
    case 'sup':
      ctx.output.push(
        <sup key={key} className={className}>
          {children}
        </sup>,
      );
      break;
    case 'span':
      ctx.output.push(
        <span key={key} className={className}>
          {children}
        </span>,
      );
      break;
    default:
      // 未知 tag fallback span (sanitize 一般已剥掉 unsafe tag).
      ctx.output.push(
        <span key={key} className={className} data-tag-fallback={tag}>
          {children}
        </span>,
      );
  }
}

function walkChildren(parent: Element, ctx: WalkContext): void {
  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      walkTextNode(child as Text, ctx);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      walkElement(child as Element, ctx);
    }
    // 忽略 comment / doctype / 其它 (sanitize 已剥)
  });
}

/**
 * 把题干 HTML + marks 转为 ReactNode[].
 *
 * Public API. 调用方:
 *   - FbCard.stem 渲染
 *   - FbPassage.PassageParagraphNode 渲染
 *
 * 入参 marks 不排序也 OK — 内部按 textStart asc 排序后 walk.
 */
export function renderStemWithMarks(
  html: string,
  marks: readonly Mark[],
): readonly ReactNode[] {
  if (typeof html !== 'string' || html.length === 0) return [];
  const safeHtml = DOMPurify.sanitize(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${safeHtml}</body>`, 'text/html');
  const root = doc.body;
  if (root === null) return [safeHtml];
  const sortedMarks = [...marks].sort((a, b) => a.textStart - b.textStart);
  const ctx: WalkContext = {
    textCursor: 0,
    output: [],
    marks: sortedMarks,
    keyCounter: { value: 0 },
  };
  walkChildren(root, ctx);
  return ctx.output;
}
