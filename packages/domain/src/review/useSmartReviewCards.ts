import { useMemo } from 'react';

import type { ReviewItemV2 } from '@sikao/api-client/types/review';

import type {
  RecentAnswerForAggregation,
  SmartReviewCard,
  SmartReviewCardsResult,
  SmartReviewComputationInput,
} from './types';

const RECENT_DAYS_WINDOW = 14;
const RECOMMENDED_LENGTH_WINDOW_DAYS = 7;
const DEFAULT_SESSION_LENGTH = 15;

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isActiveReviewItem(item: ReviewItemV2): boolean {
  return item.status === 'pending' || item.status === 'in_progress' || item.status === 'probationary';
}

function answeredWithinWindow(answeredAt: string, now: Date): boolean {
  const diffMs = now.getTime() - new Date(answeredAt).getTime();
  return diffMs <= RECENT_DAYS_WINDOW * 24 * 60 * 60 * 1000;
}

function sortQuestionIdsByCount(counter: Map<number, number>): number[] {
  return [...counter.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0] - right[0];
    })
    .map(([questionId]) => questionId);
}

export function buildRecommendedSessionLength(
  recentAnswers: readonly RecentAnswerForAggregation[],
  options: {
    readonly defaultLength?: number;
    readonly now?: Date;
  } = {},
): number {
  const defaultLength = options.defaultLength ?? DEFAULT_SESSION_LENGTH;
  const now = options.now ?? new Date();
  if (recentAnswers.length === 0) {
    return defaultLength;
  }
  const cutoffMs =
    now.getTime() - RECOMMENDED_LENGTH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentWindowAnswers = recentAnswers.filter(
    (answer) => new Date(answer.answeredAt).getTime() >= cutoffMs,
  );
  if (recentWindowAnswers.length === 0) {
    return defaultLength;
  }

  const sessionGroups = new Map<number, RecentAnswerForAggregation[]>();
  for (const answer of recentWindowAnswers) {
    const group = sessionGroups.get(answer.sessionId) ?? [];
    group.push(answer);
    sessionGroups.set(answer.sessionId, group);
  }
  if (sessionGroups.size === 0) {
    return defaultLength;
  }

  const sessionStats = [...sessionGroups.values()].map((answers) => {
    const durations = answers
      .map((answer) => answer.durationS)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    return {
      questionCount: answers.length,
      avgDuration: average(durations),
      completed: answers.length >= 5,
    };
  });

  const avgQuestionPerSession =
    average(sessionStats.map((stat) => stat.questionCount)) ?? defaultLength;
  const completionRate =
    sessionStats.filter((stat) => stat.completed).length / sessionStats.length;
  const avgDurationS =
    average(
      sessionStats
        .map((stat) => stat.avgDuration)
        .filter((value): value is number => typeof value === 'number' && value > 0),
    ) ?? 60;

  let recommended = Math.floor((20 * 60) / Math.max(avgDurationS, 30));
  if (completionRate < 0.5) {
    recommended = Math.floor(recommended * 0.7);
  }
  if (completionRate < 0.3) {
    recommended = Math.floor(recommended * 0.5);
  }
  recommended = Math.round((recommended + avgQuestionPerSession) / 2);
  const rounded = Math.round(recommended / 5) * 5;
  return Math.max(5, Math.min(30, rounded));
}

export function buildSmartReviewCards({
  items,
  recentAnswers,
  now = new Date(),
}: SmartReviewComputationInput): SmartReviewCardsResult {
  const activeItems = items.filter(isActiveReviewItem);
  const activeQuestionIds = new Set(
    activeItems
      .map((item) => item.questionId)
      .filter((questionId): questionId is number => typeof questionId === 'number'),
  );
  const recentWrongAnswers = recentAnswers.filter(
    (answer) =>
      answer.questionId > 0 &&
      answer.isCorrect === false &&
      answeredWithinWindow(answer.answeredAt, now),
  );

  const cards: SmartReviewCard[] = [];

  const wrongCounter = new Map<number, number>();
  for (const answer of recentWrongAnswers) {
    if (!activeQuestionIds.has(answer.questionId)) {
      continue;
    }
    wrongCounter.set(answer.questionId, (wrongCounter.get(answer.questionId) ?? 0) + 1);
  }
  const highFrequencyWrongIds = sortQuestionIdsByCount(wrongCounter).filter(
    (questionId) => (wrongCounter.get(questionId) ?? 0) >= 2,
  );
  if (highFrequencyWrongIds.length > 0) {
    cards.push({
      type: 'high_frequency_wrong',
      title: '高频错点',
      subtitle: `最近 ${RECENT_DAYS_WINDOW} 天重复答错 ${highFrequencyWrongIds.length} 题`,
      count: Math.min(highFrequencyWrongIds.length, 20),
      questionIds: highFrequencyWrongIds.slice(0, 20),
      ctaLabel: '集中突破',
    });
  }

  const longUntouchedIds = activeItems
    .filter((item) => item.nextReviewAt)
    .map((item) => ({
      item,
      nextReviewAt: new Date(item.nextReviewAt as string),
    }))
    .filter(({ nextReviewAt }) => {
      const diffMs = now.getTime() - nextReviewAt.getTime();
      return diffMs >= RECENT_DAYS_WINDOW * 24 * 60 * 60 * 1000;
    })
    .sort((left, right) => left.nextReviewAt.getTime() - right.nextReviewAt.getTime())
    .map(({ item }) => item.questionId)
    .filter((questionId): questionId is number => typeof questionId === 'number');
  if (longUntouchedIds.length > 0) {
    cards.push({
      type: 'long_unreviewed',
      title: '长期未碰',
      subtitle: `有 ${longUntouchedIds.length} 题超过 ${RECENT_DAYS_WINDOW} 天未复盘`,
      count: Math.min(longUntouchedIds.length, 20),
      questionIds: longUntouchedIds.slice(0, 20),
      ctaLabel: '立即复盘',
    });
  }

  const activeByQuestionId = new Map<number, ReviewItemV2>();
  for (const item of activeItems) {
    if (typeof item.questionId === 'number') {
      activeByQuestionId.set(item.questionId, item);
    }
  }
  const reFailCandidates = sortQuestionIdsByCount(wrongCounter).filter((questionId) => {
    const item = activeByQuestionId.get(questionId);
    return item?.correctStreak === 0;
  });
  if (reFailCandidates.length > 0) {
    cards.push({
      type: 'predicted_re_fail',
      title: '预测再错',
      subtitle: '这些题最近频繁失分，且当前仍未形成正确连击。',
      count: Math.min(reFailCandidates.length, 20),
      questionIds: reFailCandidates.slice(0, 20),
      ctaLabel: '重点攻克',
    });
  }

  return {
    cards,
    recommendedSessionLength: buildRecommendedSessionLength(recentAnswers),
  };
}

export interface UseSmartReviewCardsOptions {
  readonly items: readonly ReviewItemV2[];
  readonly recentAnswers: readonly RecentAnswerForAggregation[];
}

export function useSmartReviewCards(
  options: UseSmartReviewCardsOptions,
): SmartReviewCardsResult {
  return useMemo(
    () =>
      buildSmartReviewCards({
        items: options.items,
        recentAnswers: options.recentAnswers,
      }),
    [options.items, options.recentAnswers],
  );
}
