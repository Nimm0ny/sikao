import { useMemo } from 'react';

import { useWeeklySummary } from '@sikao/api-client/queries/weeklyReviewQueries';
import type { ReviewWeeklySummaryQuery } from '@sikao/api-client/types/review';

import { useDebtManagement, type UseDebtManagementOptions } from './useDebtManagement';

export interface UseWeeklyReviewOptions {
  readonly summary?: ReviewWeeklySummaryQuery;
  readonly debt?: UseDebtManagementOptions;
}

export function useWeeklyReview(options: UseWeeklyReviewOptions = {}) {
  const summaryQuery = useWeeklySummary(options.summary ?? {});
  const debt = useDebtManagement(options.debt);

  return useMemo(
    () => ({
      summaryQuery,
      debt,
      summary: summaryQuery.data ?? null,
      isLoading: summaryQuery.isLoading || debt.isLoading,
      isError: summaryQuery.isError || debt.isError,
    }),
    [debt, summaryQuery],
  );
}

export const useWeeklyReviewDetail = useWeeklyReview;
