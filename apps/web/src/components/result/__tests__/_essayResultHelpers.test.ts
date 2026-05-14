import { describe, expect, it } from 'vitest';
import {
  classifyRubricTone,
  isWeakQuestion,
  computeBarWidth,
  splitTextWithHighlights,
  ESSAY_WEAK_THRESHOLD,
} from '../_essayResultHelpers';

describe('classifyRubricTone', () => {
  it('returns ok when ratio >= 0.85', () => {
    expect(classifyRubricTone(5, 5)).toBe('ok');
    expect(classifyRubricTone(8.5, 10)).toBe('ok');
  });

  it('returns err when ratio < 0.6', () => {
    expect(classifyRubricTone(3, 10)).toBe('err');
    expect(classifyRubricTone(0, 5)).toBe('err');
  });

  it('returns neutral for middle range', () => {
    expect(classifyRubricTone(6, 10)).toBe('neutral');
    expect(classifyRubricTone(4, 5)).toBe('neutral');
  });

  it('returns neutral when max <= 0 (防除零)', () => {
    expect(classifyRubricTone(5, 0)).toBe('neutral');
    expect(classifyRubricTone(5, -1)).toBe('neutral');
  });
});

describe('isWeakQuestion', () => {
  it('returns true when ratio < threshold (0.6)', () => {
    expect(isWeakQuestion(5, 15)).toBe(true); // 0.33
    expect(ESSAY_WEAK_THRESHOLD).toBe(0.6);
  });

  it('returns false when ratio >= threshold', () => {
    expect(isWeakQuestion(12, 15)).toBe(false); // 0.8
    expect(isWeakQuestion(9, 15)).toBe(false); // 0.6 (边界 boundary not strict)
  });

  it('returns false when max <= 0', () => {
    expect(isWeakQuestion(5, 0)).toBe(false);
  });
});

describe('computeBarWidth', () => {
  it('returns percent (0-100) of score/max', () => {
    expect(computeBarWidth(12, 15)).toBeCloseTo(80);
    expect(computeBarWidth(5, 10)).toBe(50);
  });

  it('clamps to 0-100', () => {
    expect(computeBarWidth(150, 100)).toBe(100);
    expect(computeBarWidth(-5, 100)).toBe(0);
  });

  it('returns 0 when max <= 0', () => {
    expect(computeBarWidth(5, 0)).toBe(0);
  });
});

describe('splitTextWithHighlights', () => {
  it('returns single non-mark chunk when no highlights', () => {
    expect(splitTextWithHighlights('hello world', [])).toEqual([
      { chunk: 'hello world', isMark: false },
    ]);
  });

  it('splits around a single match', () => {
    expect(splitTextWithHighlights('AAA M3 BBB', ['M3'])).toEqual([
      { chunk: 'AAA ', isMark: false },
      { chunk: 'M3', isMark: true },
      { chunk: ' BBB', isMark: false },
    ]);
  });

  it('splits multiple highlights', () => {
    expect(splitTextWithHighlights('a M1 b M2 c', ['M1', 'M2'])).toEqual([
      { chunk: 'a ', isMark: false },
      { chunk: 'M1', isMark: true },
      { chunk: ' b ', isMark: false },
      { chunk: 'M2', isMark: true },
      { chunk: ' c', isMark: false },
    ]);
  });

  it('handles empty text', () => {
    expect(splitTextWithHighlights('', ['x'])).toEqual([
      { chunk: '', isMark: false },
    ]);
  });

  it('skips empty highlight string', () => {
    expect(splitTextWithHighlights('hello', [''])).toEqual([
      { chunk: 'hello', isMark: false },
    ]);
  });

  it('handles overlap by keeping first hit', () => {
    // "ABCD" with ['AB', 'BC'] → only AB hits (BC starts at 1, < AB.end=2 = overlap)
    const parts = splitTextWithHighlights('ABCD', ['AB', 'BC']);
    expect(parts.find((p) => p.isMark)?.chunk).toBe('AB');
    // Should have 2 chunks (mark "AB" + plain "CD")
    expect(parts).toEqual([
      { chunk: 'AB', isMark: true },
      { chunk: 'CD', isMark: false },
    ]);
  });

  it('returns text-only when highlight not found', () => {
    expect(splitTextWithHighlights('abc', ['xyz'])).toEqual([
      { chunk: 'abc', isMark: false },
    ]);
  });

  it('handles CJK characters', () => {
    const parts = splitTextWithHighlights('扣分集中在 引用准确度 这一项', ['引用准确度']);
    expect(parts).toEqual([
      { chunk: '扣分集中在 ', isMark: false },
      { chunk: '引用准确度', isMark: true },
      { chunk: ' 这一项', isMark: false },
    ]);
  });
});
