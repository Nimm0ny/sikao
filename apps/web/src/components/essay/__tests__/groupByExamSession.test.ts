import { describe, expect, it } from 'vitest';
import { groupByExamSession } from '../groupByExamSession';
import type { EssayGradingV2 } from '@sikao/api-client/types/api';

function rec(id: number, createdAt: string): EssayGradingV2 {
  return {
    id,
    questionId: 1000 + id,
    answerText: '',
    status: 'completed',
    score: 80,
    feedback: null,
    failureReason: null,
    createdAt,
    gradedAt: null,
  };
}

describe('groupByExamSession', () => {
  it('empty input → empty array', () => {
    expect(groupByExamSession([])).toEqual([]);
  });

  it('single record → 1 group, isExamSession false', () => {
    const out = groupByExamSession([rec(1, '2026-05-07T10:00:00Z')]);
    expect(out).toHaveLength(1);
    expect(out[0].isExamSession).toBe(false);
    expect(out[0].records).toHaveLength(1);
  });

  it('5 records within 30s → 1 group, isExamSession true (整卷模考)', () => {
    // Promise.allSettled 并发提交, createdAt 间隔通常 < 1s. 30s 阈值留余量.
    const records = [
      rec(5, '2026-05-07T10:00:05Z'),
      rec(4, '2026-05-07T10:00:04Z'),
      rec(3, '2026-05-07T10:00:03Z'),
      rec(2, '2026-05-07T10:00:02Z'),
      rec(1, '2026-05-07T10:00:01Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(1);
    expect(out[0].isExamSession).toBe(true);
    expect(out[0].records.map((r) => r.id)).toEqual([5, 4, 3, 2, 1]);
  });

  it('records spaced far apart → each its own group, isExamSession all false', () => {
    // 用户单题练习 3 次, 每次间隔几小时. 都视为独立 group.
    const records = [
      rec(3, '2026-05-07T15:00:00Z'),
      rec(2, '2026-05-07T12:00:00Z'),
      rec(1, '2026-05-07T09:00:00Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(3);
    expect(out.every((g) => !g.isExamSession)).toBe(true);
  });

  it('mixed: 1 整卷模考 (3 题) + 2 单题 → 3 groups (1 exam, 2 single)', () => {
    const records = [
      // 单题 1 - 16:00
      rec(8, '2026-05-07T16:00:00Z'),
      // 整卷模考 (3 题, 全在 14:00:00-14:00:10 内)
      rec(7, '2026-05-07T14:00:10Z'),
      rec(6, '2026-05-07T14:00:05Z'),
      rec(5, '2026-05-07T14:00:00Z'),
      // 单题 2 - 09:00
      rec(1, '2026-05-07T09:00:00Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ isExamSession: false }); // 单题 1
    expect(out[0].records.map((r) => r.id)).toEqual([8]);
    expect(out[1]).toMatchObject({ isExamSession: true });  // 整卷
    expect(out[1].records.map((r) => r.id)).toEqual([7, 6, 5]);
    expect(out[2]).toMatchObject({ isExamSession: false }); // 单题 2
  });

  it('exactly 30s gap → still in same group (≤ inclusive)', () => {
    const records = [
      rec(2, '2026-05-07T10:00:30Z'),
      rec(1, '2026-05-07T10:00:00Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(1);
    expect(out[0].isExamSession).toBe(true);
  });

  it('31s gap → split into 2 groups', () => {
    const records = [
      rec(2, '2026-05-07T10:00:31Z'),
      rec(1, '2026-05-07T10:00:00Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(2);
  });

  it('invalid createdAt → conservative split (don\'t over-group)', () => {
    const records = [
      rec(2, 'not-a-date'),
      rec(1, '2026-05-07T10:00:00Z'),
    ];
    const out = groupByExamSession(records);
    expect(out).toHaveLength(2);
  });
});
