import { describe, it, expect } from 'vitest';
import {
  deriveQuestionTimings,
  pickSlowestQuestions,
  formatElapsed,
  PAUSE_THRESHOLD_SEC,
  type AnswerTimingInput,
} from '@sikao/shared-utils';

const SESSION_START = '2026-04-27T10:00:00Z';

function ans(qid: number | string, no: number, isoOffsetSec: number): AnswerTimingInput {
  return {
    questionId: qid,
    questionNo: no,
    answeredAt: new Date(Date.parse(SESSION_START) + isoOffsetSec * 1000).toISOString(),
  };
}

describe('deriveQuestionTimings', () => {
  it('returns [] for empty answers', () => {
    expect(deriveQuestionTimings([], SESSION_START)).toEqual([]);
  });

  it('uses session start as baseline for the first question', () => {
    const out = deriveQuestionTimings([ans(101, 1, 90)], SESSION_START);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ questionId: '101', questionNo: 1, elapsedSec: 90, paused: false });
  });

  it('computes pairwise deltas for subsequent questions', () => {
    const out = deriveQuestionTimings(
      [ans(1, 1, 60), ans(2, 2, 150), ans(3, 3, 210)],
      SESSION_START,
    );
    expect(out.map((t) => t.elapsedSec)).toEqual([60, 90, 60]);
  });

  it('marks elapsed > PAUSE_THRESHOLD_SEC as paused with elapsedSec=0', () => {
    // Q1 takes 30 min (1800s) > 10 min threshold → paused
    const out = deriveQuestionTimings(
      [ans(1, 1, 1800), ans(2, 2, 1860)],
      SESSION_START,
    );
    expect(out[0]).toMatchObject({ paused: true, elapsedSec: 0 });
    expect(out[1]).toMatchObject({ paused: false, elapsedSec: 60 });
  });

  it('floors negative deltas (clock skew / out-of-order) to 0, not paused', () => {
    // Q2 answered_at < Q1 (impossible but defensive)
    const out = deriveQuestionTimings(
      [ans(1, 1, 100), ans(2, 2, 50)],
      SESSION_START,
    );
    expect(out[1]).toMatchObject({ elapsedSec: 0, paused: false });
  });

  it('coerces numeric questionId to string at boundary', () => {
    const out = deriveQuestionTimings([ans(13319187, 1, 30)], SESSION_START);
    expect(out[0].questionId).toBe('13319187');
    expect(typeof out[0].questionId).toBe('string');
  });

  it('throws on invalid sessionStartedAt (fail-fast, not silent NaN)', () => {
    expect(() => deriveQuestionTimings([ans(1, 1, 30)], 'not-a-date')).toThrow(/invalid sessionStartedAt/);
  });

  it('throws on invalid answeredAt with question id in message', () => {
    const bad: AnswerTimingInput = { questionId: 999, questionNo: 1, answeredAt: 'garbage' };
    expect(() => deriveQuestionTimings([bad], SESSION_START)).toThrow(/999/);
  });

  it('PAUSE_THRESHOLD_SEC is exported as 600 (10 min)', () => {
    expect(PAUSE_THRESHOLD_SEC).toBe(600);
  });
});

describe('pickSlowestQuestions', () => {
  it('returns top N by elapsedSec desc', () => {
    const timings = [
      { questionId: 'a', questionNo: 1, elapsedSec: 60, paused: false },
      { questionId: 'b', questionNo: 2, elapsedSec: 200, paused: false },
      { questionId: 'c', questionNo: 3, elapsedSec: 90, paused: false },
      { questionId: 'd', questionNo: 4, elapsedSec: 150, paused: false },
    ];
    const top2 = pickSlowestQuestions(timings, 2);
    expect(top2.map((t) => t.questionId)).toEqual(['b', 'd']);
  });

  it('excludes paused items even if elapsedSec is high (it would be 0 anyway)', () => {
    const timings = [
      { questionId: 'a', questionNo: 1, elapsedSec: 0, paused: true },
      { questionId: 'b', questionNo: 2, elapsedSec: 30, paused: false },
    ];
    expect(pickSlowestQuestions(timings, 5).map((t) => t.questionId)).toEqual(['b']);
  });

  it('excludes 0-elapsed (unanswered / instant) items', () => {
    const timings = [
      { questionId: 'a', questionNo: 1, elapsedSec: 0, paused: false },
      { questionId: 'b', questionNo: 2, elapsedSec: 30, paused: false },
    ];
    expect(pickSlowestQuestions(timings, 5).map((t) => t.questionId)).toEqual(['b']);
  });

  it('returns at most N items even if more candidates', () => {
    const timings = Array.from({ length: 10 }, (_, i) => ({
      questionId: String(i),
      questionNo: i + 1,
      elapsedSec: (i + 1) * 10,
      paused: false,
    }));
    expect(pickSlowestQuestions(timings, 3)).toHaveLength(3);
  });

  it('returns [] for empty input', () => {
    expect(pickSlowestQuestions([], 5)).toEqual([]);
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [60, '1:00'],
    [125, '2:05'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [-30, '0:00'],
  ])('formats %d sec as %s', (sec, expected) => {
    expect(formatElapsed(sec)).toBe(expected);
  });
});
