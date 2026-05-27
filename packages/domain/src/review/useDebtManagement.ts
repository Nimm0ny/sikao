import { useMemo } from 'react';

import {
  useReviewDebtPlan,
  useReviewDebtSnapshot,
  useSkipReviewDebtRampup,
  useTriggerReviewDebtRedistribute,
} from '@sikao/api-client/queries/weeklyReviewQueries';
import type { ReviewDebtPlanQuery } from '@sikao/api-client/types/review';

export interface UseDebtManagementOptions {
  readonly plan?: ReviewDebtPlanQuery;
}

export function useDebtManagement(options: UseDebtManagementOptions = {}) {
  const snapshotQuery = useReviewDebtSnapshot();
  const planQuery = useReviewDebtPlan(options.plan ?? {});
  const redistributeMutation = useTriggerReviewDebtRedistribute();
  const skipRampupMutation = useSkipReviewDebtRampup();

  return useMemo(
    () => ({
      snapshotQuery,
      planQuery,
      redistributeMutation,
      skipRampupMutation,
      isLoading: snapshotQuery.isLoading || planQuery.isLoading,
      isError: snapshotQuery.isError || planQuery.isError,
      snapshot: snapshotQuery.data ?? null,
      plan: planQuery.data ?? null,
    }),
    [planQuery, redistributeMutation, skipRampupMutation, snapshotQuery],
  );
}
