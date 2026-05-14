// P5a 划线数据层 (SIKAO 答题系统行测) — RangeSerializer.
//
// 把浏览器 Selection 内的 Range 序列化成 textIndex-based offset
// ({ textStart, textLength }). textIndex 模式比 DOM Range 序列化对 React
// rerender / sanitize 漂移 更稳定 — 题干 DOM 节点结构会随 highlight 渲染
// 重新切片, 但 textContent 保持不变, 所以基于字符偏移更可靠.
//
// Algorithm based on
//   frontend/src/features/essay-exam/lib/highlightRanges.ts:106 selectionOffsets
// (clone Range + selectNodeContents + setEnd + toString().length).
// 此处新建独立文件 + 独立测试, 不 import essay 模块 — 跨 feature 边界违反
// 目录耦合.

export interface SerializedRangeBase {
  readonly questionId: string;
  readonly textStart: number;
  readonly textLength: number;
}

/**
 * 把 containerNode 范围内的 Range 序列化成 questionId-scoped textIndex
 * offset. 失败返回 null.
 *
 * 失败 case:
 * - range.startContainer 不在 containerNode 内 (跨容器选区)
 * - range collapsed (textLength === 0)
 * - range.toString() 长度为 0
 */
export function serializeSelection(
  containerNode: Node,
  range: Range,
  questionId: string,
): SerializedRangeBase | null {
  if (!containerNode.contains(range.startContainer)) return null;
  if (!containerNode.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(containerNode);
  pre.setEnd(range.startContainer, range.startOffset);
  const textStart = pre.toString().length;
  const textLength = range.toString().length;
  if (textLength <= 0) return null;
  return { questionId, textStart, textLength };
}
