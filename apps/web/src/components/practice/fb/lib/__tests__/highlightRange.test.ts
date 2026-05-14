import { describe, it, expect } from 'vitest';
import { serializeSelection } from '../highlightRange';

// P5a 划线数据层 — RangeSerializer 测试 (TDD red→green).
// Algorithm 参考 frontend/src/features/essay-exam/lib/highlightRanges.ts:106
// (selectionOffsets). 此处不 import essay, 跨 feature 边界违反目录耦合 —
// 故新建独立文件 + 独立测试.

function makeRange(node: Node, startOffset: number, endNode: Node, endOffset: number): Range {
  const r = document.createRange();
  r.setStart(node, startOffset);
  r.setEnd(endNode, endOffset);
  return r;
}

describe('serializeSelection', () => {
  it('returns {textStart,textLength,questionId} for a single text-node selection of 5 chars', () => {
    const container = document.createElement('div');
    container.textContent = '人民对美好生活的向往';
    document.body.appendChild(container);
    try {
      const textNode = container.firstChild as Text;
      const range = makeRange(textNode, 0, textNode, 5);
      const result = serializeSelection(container, range, 'q1');
      expect(result).toEqual({ questionId: 'q1', textStart: 0, textLength: 5 });
    } finally {
      document.body.removeChild(container);
    }
  });

  it('measures offsets across nested inline elements (strong / em) via toString().length', () => {
    const container = document.createElement('div');
    // 文本内容 'ABCDEFGHIJ' (10 字符), 但跨 <strong>CDE</strong> 节点.
    container.innerHTML = 'AB<strong>CDE</strong>FGHIJ';
    document.body.appendChild(container);
    try {
      // 选 'CDEFG' (start=2, length=5): start 在 <strong> 的 text 节点 offset 0,
      // end 在尾部 'FGHIJ' text 节点 offset 2.
      const strongText = container.querySelector('strong')!.firstChild as Text;
      const tailText = container.childNodes[2] as Text; // 'FGHIJ'
      const range = makeRange(strongText, 0, tailText, 2);
      const result = serializeSelection(container, range, 'q2');
      expect(result).toEqual({ questionId: 'q2', textStart: 2, textLength: 5 });
    } finally {
      document.body.removeChild(container);
    }
  });

  it('returns null when range.startContainer is outside containerNode', () => {
    const container = document.createElement('div');
    container.textContent = '内部文本';
    const outside = document.createElement('div');
    outside.textContent = '外部文本';
    document.body.appendChild(container);
    document.body.appendChild(outside);
    try {
      const outsideText = outside.firstChild as Text;
      const range = makeRange(outsideText, 0, outsideText, 2);
      const result = serializeSelection(container, range, 'q3');
      expect(result).toBeNull();
    } finally {
      document.body.removeChild(container);
      document.body.removeChild(outside);
    }
  });

  it('returns null for collapsed range (empty selection)', () => {
    const container = document.createElement('div');
    container.textContent = '一些文本';
    document.body.appendChild(container);
    try {
      const textNode = container.firstChild as Text;
      const range = makeRange(textNode, 2, textNode, 2);
      const result = serializeSelection(container, range, 'q4');
      expect(result).toBeNull();
    } finally {
      document.body.removeChild(container);
    }
  });

  it('returns {textStart:0, textLength: full} when range covers the entire container', () => {
    const container = document.createElement('div');
    container.textContent = '完整选中这段文字';
    document.body.appendChild(container);
    try {
      const range = document.createRange();
      range.selectNodeContents(container);
      const result = serializeSelection(container, range, 'q5');
      expect(result).toEqual({
        questionId: 'q5',
        textStart: 0,
        textLength: container.textContent!.length,
      });
    } finally {
      document.body.removeChild(container);
    }
  });
});
