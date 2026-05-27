import { describe, expect, it } from 'vitest';

import type { ReviewItemV2 } from '@sikao/api-client/types/review';

import {
  buildRecommendedSessionLength,
  buildSmartReviewCards,
} from '../useSmartReviewCards';
import type { RecentAnswerForAggregation } from '../types';

function makeItem(id: number, overrides: Partial<ReviewItemV2> = {}): ReviewItemV2 {
  return {
    id,
    kind: 'wrong_answer',
    title: `Item ${id}`,
    href: `/q/${id}`,
    status: 'pending',
    questionId: id,
    correctStreak: 0,
    hasCauseAnalysis: false,
    hasUserNotes: false,
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-20T00:00:00Z',
    nextReviewAt: '2026-05-10T00:00:00Z',
    ...overrides,
  };
}

function makeAnswer(
  questionId: number,
  overrides: Partial<RecentAnswerForAggregation> = {},
): RecentAnswerForAggregation {
  return {
    questionId,
    sessionId: 1,
    isCorrect: false,
    answeredAt: '2026-05-26T00:00:00Z',
    confidence: null,
    durationS: 60,
    ...overrides,
  };
}

describe('buildRecommendedSessionLength', () => {
  it('returns 15 when there are no recent answers', () => {
    expect(buildRecommendedSessionLength([])).toBe(15);
  });

  it('ignores answers outside the 7-day recommendation window', () => {
    expect(
      buildRecommendedSessionLength(
        [makeAnswer(1, { answeredAt: '2026-05-01T00:00:00Z' })],
        { now: new Date('2026-05-27T00:00:00Z') },
      ),
    ).toBe(15);
  });

  it('aligns the recommendation with recent session habits', () => {
    const result = buildRecommendedSessionLength(
      [
        ...Array.from({ length: 10 }, (_, index) =>
          makeAnswer(index + 1, {
            sessionId: 1,
            durationS: 60,
            answeredAt: '2026-05-26T00:00:00Z',
          }),
        ),
        ...Array.from({ length: 10 }, (_, index) =>
          makeAnswer(index + 11, {
            sessionId: 2,
            durationS: 60,
            answeredAt: '2026-05-25T00:00:00Z',
          }),
        ),
      ],
      { now: new Date('2026-05-27T00:00:00Z') },
    );

    expect(result).toBe(15);
  });

  it('reduces the recommendation when completion rate is low', () => {
    const result = buildRecommendedSessionLength(
      [
        ...Array.from({ length: 4 }, (_, index) =>
          makeAnswer(index + 1, {
            sessionId: 1,
            durationS: 60,
            answeredAt: '2026-05-26T00:00:00Z',
          }),
        ),
        ...Array.from({ length: 4 }, (_, index) =>
          makeAnswer(index + 11, {
            sessionId: 2,
            durationS: 60,
            answeredAt: '2026-05-25T00:00:00Z',
          }),
        ),
      ],
      { now: new Date('2026-05-27T00:00:00Z') },
    );

    expect(result).toBe(5);
  });

  it('clamps high recommendations to 30', () => {
    const result = buildRecommendedSessionLength(
      Array.from({ length: 40 }, (_, index) =>
        makeAnswer(index + 1, {
          sessionId: 1,
          durationS: 10,
          answeredAt: '2026-05-26T00:00:00Z',
        }),
      ),
      { now: new Date('2026-05-27T00:00:00Z') },
    );

    expect(result).toBe(30);
  });
});

describe('buildSmartReviewCards', () => {
  it('returns no cards when there is no active review data', () => {
    const result = buildSmartReviewCards({ items: [], recentAnswers: [] });
    expect(result.cards).toEqual([]);
  });

  it('builds a high-frequency wrong card from repeated recent wrong answers', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101)],
      recentAnswers: [makeAnswer(101), makeAnswer(101, { sessionId: 2 })],
    });
    expect(result.cards[0]?.type).toBe('high_frequency_wrong');
    expect(result.cards[0]?.questionIds).toEqual([101]);
  });

  it('ignores wrong answers for non-active review items', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101, { status: 'archived' })],
      recentAnswers: [makeAnswer(101), makeAnswer(101, { sessionId: 2 })],
    });
    expect(result.cards.find((card) => card.type === 'high_frequency_wrong')).toBeUndefined();
  });

  it('builds a long-unreviewed card from overdue nextReviewAt values', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101, { nextReviewAt: '2026-05-01T00:00:00Z' })],
      recentAnswers: [],
      now: new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.cards.find((card) => card.type === 'long_unreviewed')?.questionIds).toEqual([101]);
  });

  it('does not include long-unreviewed cards for fresh review items', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101, { nextReviewAt: '2026-05-25T00:00:00Z' })],
      recentAnswers: [],
      now: new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.cards.find((card) => card.type === 'long_unreviewed')).toBeUndefined();
  });

  it('builds predicted re-fail cards only for zero-streak active items', () => {
    const result = buildSmartReviewCards({
      items: [
        makeItem(101, { correctStreak: 0 }),
        makeItem(102, { correctStreak: 2 }),
      ],
      recentAnswers: [
        makeAnswer(101),
        makeAnswer(101, { sessionId: 2 }),
        makeAnswer(102),
        makeAnswer(102, { sessionId: 3 }),
      ],
    });
    expect(result.cards.find((card) => card.type === 'predicted_re_fail')?.questionIds).toEqual([101]);
  });

  it('ignores stale wrong answers outside the rolling window', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101)],
      recentAnswers: [
        makeAnswer(101, { answeredAt: '2026-05-01T00:00:00Z' }),
        makeAnswer(101, { answeredAt: '2026-05-02T00:00:00Z', sessionId: 2 }),
      ],
      now: new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.cards.find((card) => card.type === 'high_frequency_wrong')).toBeUndefined();
  });

  it('caps card question ids at 20 entries', () => {
    const itemIds = Array.from({ length: 25 }, (_, index) => index + 1);
    const result = buildSmartReviewCards({
      items: itemIds.map((id) => makeItem(id)),
      recentAnswers: itemIds.flatMap((id) => [
        makeAnswer(id, { sessionId: id }),
        makeAnswer(id, { sessionId: id + 100 }),
      ]),
    });
    expect(result.cards.find((card) => card.type === 'high_frequency_wrong')?.questionIds).toHaveLength(20);
  });

  it('returns cards ordered by high-frequency, long-unreviewed, then predicted re-fail', () => {
    const result = buildSmartReviewCards({
      items: [makeItem(101), makeItem(102, { nextReviewAt: '2026-05-01T00:00:00Z' })],
      recentAnswers: [makeAnswer(101), makeAnswer(101, { sessionId: 2 })],
      now: new Date('2026-05-27T00:00:00Z'),
    });
    expect(result.cards.map((card) => card.type)).toEqual([
      'high_frequency_wrong',
      'long_unreviewed',
      'predicted_re_fail',
    ]);
  });
});
