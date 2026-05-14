import { describe, expect, it } from 'vitest';
import { computeWeightedTotal } from '../lib/examScore';

describe('computeWeightedTotal', () => {
  it('weights by fullScore — large-essay tanking gives correct 60 (not 80)', () => {
    // 申论 100 分卷: 概括 10 / 对策 15 / 分析 20 / 应用文 15 / 大作文 40
    // 用户 [10/10, 15/15, 20/20, 15/15, 0/40] (作文崩了)
    // 真实加权: (10*1 + 15*1 + 20*1 + 15*1 + 40*0) / 100 = 60
    // 错误 1/N 平均: (100 + 100 + 100 + 100 + 0) / 5 = 80
    const items = [
      { backendId: 1001, fullScore: 10, score: 100 },
      { backendId: 1002, fullScore: 15, score: 100 },
      { backendId: 1003, fullScore: 20, score: 100 },
      { backendId: 1004, fullScore: 15, score: 100 },
      { backendId: 1005, fullScore: 40, score: 0 },
    ];
    const result = computeWeightedTotal(items);
    expect(result.value).toBe(60);
    expect(result.completed).toBe(5);
    expect(result.scored).toBe(5);
    expect(result.total).toBe(5);
  });

  it('only completed questions count — partial completion still returns weighted of those', () => {
    // 5 题中 3 题完成 (10 + 15 + 20 = 45 分母), 2 题 pending (score=null).
    // [80%, 60%, 40%, null, null] → (10*0.8 + 15*0.6 + 20*0.4) / 45 * 100
    // = (8 + 9 + 8) / 45 * 100 = 25/45*100 ≈ 55.6
    const items = [
      { backendId: 1, fullScore: 10, score: 80 },
      { backendId: 2, fullScore: 15, score: 60 },
      { backendId: 3, fullScore: 20, score: 40 },
      { backendId: 4, fullScore: 15, score: null },
      { backendId: 5, fullScore: 40, score: null },
    ];
    const result = computeWeightedTotal(items);
    expect(result.value).toBe(55.6);
    expect(result.completed).toBe(3);
    expect(result.scored).toBe(3);
    expect(result.total).toBe(5);
  });

  it('all pending → value null, completed 0', () => {
    const items = [
      { backendId: 1, fullScore: 10, score: null },
      { backendId: 2, fullScore: 15, score: null },
    ];
    const result = computeWeightedTotal(items);
    expect(result.value).toBeNull();
    expect(result.completed).toBe(0);
    expect(result.scored).toBe(0);
    expect(result.total).toBe(2);
  });

  it('zero scores still produce 0, not null', () => {
    // 用户全交白卷 → 加权 0, 不是 null. null 是"无法计算" (没数据), 0 是"得 0 分".
    const items = [
      { backendId: 1, fullScore: 10, score: 0 },
      { backendId: 2, fullScore: 40, score: 0 },
    ];
    const result = computeWeightedTotal(items);
    expect(result.value).toBe(0);
    expect(result.completed).toBe(2);
    expect(result.scored).toBe(2);
  });

  it('R2 P0 — paperQuery slower than grades poll: scored > 0 even when fullScore all undefined', () => {
    // 实战场景: backend grades 全 completed, paper.questions 还在 loading
    // (paperQuery 慢) → fullScoreByQuestionId 是空 map → 全部 fullScore undefined.
    // weighted.completed=0 (eligible 全排除), weighted.value=null (无法计算),
    // 但 weighted.scored 必须 = 评分回来的题数, UI progress 才不会假死在 "0/N".
    const items = [
      { backendId: 1, score: 80 },
      { backendId: 2, score: 60 },
      { backendId: 3, score: null },
    ];
    const result = computeWeightedTotal(items);
    expect(result.scored).toBe(2);
    expect(result.completed).toBe(0);
    expect(result.value).toBeNull();
    expect(result.total).toBe(3);
  });

  it('fullScore missing on a question → that question excluded (not silently 1/N tanked)', () => {
    // 老导入卷 essayMetadata 不全, 题 #2 没 fullScore. 不能让它静默拉低均分,
    // 也不能用 hardcode fallback. 直接排除, 返回剩余有 fullScore 的题加权.
    const items = [
      { backendId: 1, fullScore: 10, score: 80 },                  // 8 分
      { backendId: 2, score: 50 },                                  // 排除
      { backendId: 3, fullScore: 40, score: 50 },                  // 20 分
    ];
    const result = computeWeightedTotal(items);
    // (8 + 20) / (10 + 40) * 100 = 28 / 50 * 100 = 56
    expect(result.value).toBe(56);
    expect(result.completed).toBe(2);
    // scored 跟 completed 解耦 — 题 #2 评分回来了但缺 fullScore, 仍计入 scored
    expect(result.scored).toBe(3);
    expect(result.total).toBe(3);
  });

  it('fullScore = 0 throws (review P1 #7 — fail-fast on backend data corruption)', () => {
    // 申论题 fullScore 不可能为 0. 静默排除会让 completed 计数对不上 ops
    // 应排查的数据问题, 改成 fail-fast throw — view 顶层 ErrorBoundary /
    // useQuery 的 isError 接住, 用户看到错误而不是错的得分.
    const items = [
      { backendId: 1, fullScore: 0, score: 80 },
      { backendId: 2, fullScore: 40, score: 50 },
    ];
    expect(() => computeWeightedTotal(items)).toThrow(/fullScore.*backendId=1/);
  });

  it('fullScore negative also throws (defensive)', () => {
    const items = [
      { backendId: 99, fullScore: -10, score: 80 },
    ];
    expect(() => computeWeightedTotal(items)).toThrow(/fullScore.*backendId=99/);
  });

  it('all completed but all fullScore missing → value null (cannot compute)', () => {
    // 整卷全部题都没 fullScore — view 显示"无法计算加权得分"占位, 不静默兜底.
    const items = [
      { backendId: 1, score: 80 },
      { backendId: 2, score: 60 },
    ];
    const result = computeWeightedTotal(items);
    expect(result.value).toBeNull();
    expect(result.completed).toBe(0);
    // 整卷全完成评分 (score 全非 null), 但 fullScore 全缺 → value null
    // 但 scored 反映真实评分回来题数, progress UI 显示 "2/2 已完成评分"
    expect(result.scored).toBe(2);
    expect(result.total).toBe(2);
  });

  it('empty input → value null, completed 0, total 0', () => {
    const result = computeWeightedTotal([]);
    expect(result.value).toBeNull();
    expect(result.completed).toBe(0);
    expect(result.scored).toBe(0);
    expect(result.total).toBe(0);
  });
});
