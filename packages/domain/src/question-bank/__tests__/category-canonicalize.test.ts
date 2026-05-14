import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ALIASES,
  canonicalizeCategoryName,
  dedupeAndCanonicalize,
} from '@sikao/domain/question-bank/category-canonicalize';

describe('canonicalizeCategoryName', () => {
  it('maps fenbi typo "资料分斩" to canonical "资料分析"', () => {
    expect(canonicalizeCategoryName('资料分斩')).toBe('资料分析');
  });

  it('maps fenbi typo "资科分析" to canonical "资料分析"', () => {
    expect(canonicalizeCategoryName('资科分析')).toBe('资料分析');
  });

  it('passes through name not in alias map (raw)', () => {
    expect(canonicalizeCategoryName('言语理解')).toBe('言语理解');
    expect(canonicalizeCategoryName('判断推理')).toBe('判断推理');
  });

  it('passes through canonical name unchanged (idempotent)', () => {
    expect(canonicalizeCategoryName('资料分析')).toBe('资料分析');
  });

  it('returns empty string unchanged (no crash)', () => {
    expect(canonicalizeCategoryName('')).toBe('');
  });

  it('exports CATEGORY_ALIASES with at least the two known fenbi typos', () => {
    expect(CATEGORY_ALIASES['资料分斩']).toBe('资料分析');
    expect(CATEGORY_ALIASES['资科分析']).toBe('资料分析');
  });
});

describe('dedupeAndCanonicalize', () => {
  it('returns empty array when input is empty', () => {
    expect(dedupeAndCanonicalize([])).toEqual([]);
  });

  it('canonicalizes name field on each item', () => {
    const input = [{ name: '资料分斩', total: 100 }];
    const result = dedupeAndCanonicalize(input);
    expect(result).toEqual([{ name: '资料分析', total: 100 }]);
  });

  it('dedupes by canonical name, keeping the first item encountered', () => {
    // 模拟 backend 同时返 "资料分斩" + "资料分析" 两行的脏数据场景:
    // 第一个 (资料分斩, total=10) canonicalize 成 "资料分析", 占位.
    // 第二个 (资料分析, total=999) canonical 已存在, 跳过 — 第一行赢.
    const input = [
      { name: '资料分斩', total: 10 },
      { name: '资料分析', total: 999 },
    ];
    const result = dedupeAndCanonicalize(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: '资料分析', total: 10 });
  });

  it('preserves order and extra fields for non-aliased names', () => {
    const input = [
      { name: '言语理解', total: 100, key: 'a' },
      { name: '判断推理', total: 200, key: 'b' },
    ];
    const result = dedupeAndCanonicalize(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: '言语理解', total: 100, key: 'a' });
    expect(result[1]).toEqual({ name: '判断推理', total: 200, key: 'b' });
  });

  it('does not mutate the input array', () => {
    const input = [{ name: '资料分斩', total: 1 }];
    const snapshot = JSON.parse(JSON.stringify(input)) as typeof input;
    dedupeAndCanonicalize(input);
    expect(input).toEqual(snapshot);
  });
});
