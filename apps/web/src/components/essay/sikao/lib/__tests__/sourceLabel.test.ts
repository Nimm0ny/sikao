import { describe, expect, it } from 'vitest';
import { buildSourceLabel } from '../sourceLabel';

describe('buildSourceLabel', () => {
  it('labels first paragraph as 段一', () => {
    const body = '第一段开头\n第二段开头\n第三段开头';
    expect(buildSourceLabel(0, body, 0)).toBe('M1·段一');
    // Anywhere within the first paragraph still maps to 段一.
    expect(buildSourceLabel(0, body, 4)).toBe('M1·段一');
  });

  it('counts \\n before start to derive paragraph index', () => {
    const body = '第一段\n第二段\n第三段';
    // `start=4` lands on the first char of 第二段
    expect(buildSourceLabel(1, body, 4)).toBe('M2·段二');
    // `start=8` lands inside 第三段
    expect(buildSourceLabel(1, body, 8)).toBe('M2·段三');
  });

  it('uses Chinese numeric for 段一 .. 段十', () => {
    // Build a body with 10 paragraphs, each "p\n"
    const body = Array.from({ length: 10 }, (_, i) => `p${i}`).join('\n');
    // start at the very last paragraph (10th = 段十). Each `p<i>` is
    // 2 chars except `p9` (also 2 chars: 'p' + '9'), so length = 10*2 + 9
    // separators = 29. Last paragraph starts at idx 27.
    const start = body.length - 1; // inside p9 (10th paragraph)
    expect(buildSourceLabel(0, body, start)).toBe('M1·段十');
  });

  it('falls back to arabic for 段十一 onwards', () => {
    // 13 paragraphs
    const body = Array.from({ length: 13 }, (_, i) => `p${i}`).join('\n');
    const start = body.length - 1; // inside last paragraph (13th)
    expect(buildSourceLabel(0, body, start)).toBe('M1·段13');
  });

  it('uses 1-based material index', () => {
    expect(buildSourceLabel(0, 'a', 0)).toBe('M1·段一');
    expect(buildSourceLabel(2, 'a', 0)).toBe('M3·段一');
  });

  it('throws on out-of-range start', () => {
    expect(() => buildSourceLabel(0, 'abc', -1)).toThrow();
    expect(() => buildSourceLabel(0, 'abc', 10)).toThrow();
  });

  it('accepts start === body.length (caret at end)', () => {
    const body = 'one\ntwo';
    // start exactly at body length is valid (caret position after last char).
    expect(buildSourceLabel(0, body, body.length)).toBe('M1·段二');
  });
});
