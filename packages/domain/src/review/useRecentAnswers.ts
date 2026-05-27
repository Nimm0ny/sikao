import { useRecentPracticeAnswersQuery } from '@sikao/api-client/queries/reviewQueries';

import type { RecentAnswerForAggregation } from './types';

export interface UseRecentAnswersOptions {
  readonly limit?: number;
  readonly includeConfidence?: boolean;
  readonly includeDuration?: boolean;
}

export function useRecentAnswers(options: UseRecentAnswersOptions = {}) {
  const query = useRecentPracticeAnswersQuery(options);
  const items: readonly RecentAnswerForAggregation[] = (query.data?.items ?? []).map((item) => ({
    questionId: item.questionId,
    sessionId: item.sessionId,
    isCorrect: item.isCorrect ?? null,
    answeredAt: item.answeredAt,
    confidence: item.confidence ?? null,
    durationS: item.durationSeconds ?? null,
  }));
  return {
    ...query,
    items,
    total: query.data?.total ?? 0,
    limit: query.data?.limit ?? (options.limit ?? 200),
  } satisfies typeof query & {
    readonly items: readonly RecentAnswerForAggregation[];
    readonly total: number;
    readonly limit: number;
  };
}
