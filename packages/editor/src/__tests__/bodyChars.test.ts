import { describe, expect, it } from 'vitest';
import { allChars, bodyChars, scratchChars } from '@sikao/answer-engine/word-limit/bodyChars';

describe('bodyChars', () => {
  it('counts CJK characters', () => {
    expect(bodyChars('传承与创新')).toBe(5);
  });

  it('excludes whitespace', () => {
    expect(bodyChars('  你 好 \n世\t界  ')).toBe(4);
  });

  it('excludes ASCII and CJK punctuation', () => {
    // 「」 + ， are punctuation; 12 visible CJK chars remain
    expect(bodyChars('「在传承中创新，在创新中发展」')).toBe(12);
    // ',' and '!' drop; 'Hello' (5) + 'world' (5) = 10
    expect(bodyChars('Hello, world!')).toBe(10);
  });

  it('counts ASCII letters and digits', () => {
    expect(bodyChars('abc 123')).toBe(6);
  });

  it('handles empty string', () => {
    expect(bodyChars('')).toBe(0);
  });
});

describe('allChars', () => {
  it('counts everything except newlines', () => {
    expect(allChars('a\nb\nc')).toBe(3);
    expect(allChars('「你好」')).toBe(4);
  });
});

describe('scratchChars', () => {
  it('strips all whitespace, keeps punctuation', () => {
    // whitespace stripped, '·' is preserved as a non-whitespace char → 8
    expect(scratchChars('立意 · 分论点\n例子')).toBe(8);
    expect(scratchChars('「划线段」')).toBe(5);
  });
});
