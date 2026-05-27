import { useMemo } from 'react';

import {
  useReviewInsightsCauses,
  useReviewInsightsRedoAccuracy,
  useReviewInsightsTrends,
} from '@sikao/api-client/queries/reviewQueries';
import type {
  ReviewInsightsCausesQuery,
  ReviewInsightsRedoAccuracyQuery,
  ReviewInsightsTrendsQuery,
} from '@sikao/api-client/types/review';

export interface UseReviewInsightsOptions {
  readonly trends?: ReviewInsightsTrendsQuery;
  readonly causes?: ReviewInsightsCausesQuery;
  readonly redoAccuracy?: ReviewInsightsRedoAccuracyQuery;
}

export function useReviewInsights(options: UseReviewInsightsOptions = {}) {
  const trendsQuery = useReviewInsightsTrends(options.trends ?? {});
  const causesQuery = useReviewInsightsCauses(options.causes ?? {});
  const redoAccuracyQuery = useReviewInsightsRedoAccuracy(options.redoAccuracy ?? {});

  return useMemo(
    () => ({
      trendsQuery,
      causesQuery,
      redoAccuracyQuery,
      isLoading:
        trendsQuery.isLoading || causesQuery.isLoading || redoAccuracyQuery.isLoading,
      isError: trendsQuery.isError || causesQuery.isError || redoAccuracyQuery.isError,
    }),
    [causesQuery, redoAccuracyQuery, trendsQuery],
  );
}
