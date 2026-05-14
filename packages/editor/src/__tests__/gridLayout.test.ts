import { describe, expect, it } from 'vitest';
import { COLS, ROWS_PER_PAGE, formatTime, layoutText } from '@sikao/answer-engine/grid-layout/gridLayout';

describe('layoutText', () => {
  it('places CJK chars one per cell, wrapping at COLS', () => {
    const text = '甲乙丙丁戊己庚辛壬癸甲乙丙丁戊己庚辛壬癸甲乙丙丁戊己'; // 26 chars, COLS=25
    const layout = layoutText(text, 450);
    expect(layout.placed).toHaveLength(26);
    expect(layout.placed[24]).toMatchObject({ row: 0, col: 24 });
    expect(layout.placed[25]).toMatchObject({ row: 1, col: 0 });
  });

  it('treats \\n as a forced row break, resetting col', () => {
    const layout = layoutText('甲乙\n丙丁', 450);
    expect(layout.placed.map((c) => `${c.row}/${c.col}`)).toEqual([
      '0/0',
      '0/1',
      '1/0',
      '1/1',
    ]);
  });

  it('classifies ASCII vs CJK', () => {
    const layout = layoutText('a你1', 450);
    expect(layout.placed.map((c) => c.kind)).toEqual(['ascii', 'cjk', 'ascii']);
  });

  it('computes cursor position at end of input', () => {
    const layout = layoutText('甲乙丙', 450);
    expect(layout.cursorRow).toBe(0);
    expect(layout.cursorCol).toBe(3);
  });

  it('computes minimum page count from minWords', () => {
    const layout = layoutText('', 1000);
    // ceil(1000 / (25*18)) = ceil(2.22) = 3
    expect(layout.pageCount).toBeGreaterThanOrEqual(3);
  });

  it('honors minimum 2 pages even for short prompts', () => {
    const layout = layoutText('', 100);
    expect(layout.pageCount).toBeGreaterThanOrEqual(2);
  });

  it('partitions placed cells by page index', () => {
    const text = 'a'.repeat(COLS * ROWS_PER_PAGE + 5); // 455 chars when COLS=25
    const layout = layoutText(text, 450);
    expect(layout.placedByPage[0]).toHaveLength(COLS * ROWS_PER_PAGE);
    expect(layout.placedByPage[1].length).toBeGreaterThanOrEqual(5);
  });
});

describe('formatTime', () => {
  it('formats mm:ss with zero padding', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('clamps negative input to 00:00', () => {
    expect(formatTime(-10)).toBe('00:00');
  });
});
