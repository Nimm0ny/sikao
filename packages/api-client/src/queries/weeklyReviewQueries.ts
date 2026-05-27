import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  ReviewDebtPlanQuery,
  ReviewDebtPlanResponseV2,
  ReviewDebtSnapshotResponseV2,
  ReviewWeeklySummaryQuery,
  ReviewWeeklySummaryResponseV2,
} from '../types/review';

export const weeklyReviewKeys = {
  all: ['review-weekly-v2'] as const,
  summary: (filters: ReviewWeeklySummaryQuery = {}) =>
    ['review-weekly-v2', 'summary', filters] as const,
  debtSnapshot: () => ['review-weekly-v2', 'debt', 'snapshot'] as const,
  debtPlan: (filters: ReviewDebtPlanQuery = {}) =>
    ['review-weekly-v2', 'debt', 'plan', filters] as const,
} as const;

function invalidateWeeklyReviewQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: weeklyReviewKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['review-v2'] });
}

export function fetchWeeklySummary(
  filters: ReviewWeeklySummaryQuery = {},
): Promise<ReviewWeeklySummaryResponseV2> {
  return api.get<ReviewWeeklySummaryResponseV2>('/review/weekly-summary', {
    params: filters,
  });
}

export function fetchReviewDebtSnapshot(): Promise<ReviewDebtSnapshotResponseV2> {
  return api.get<ReviewDebtSnapshotResponseV2>('/review/debt/snapshot');
}

export function fetchReviewDebtPlan(
  filters: ReviewDebtPlanQuery = {},
): Promise<ReviewDebtPlanResponseV2> {
  return api.get<ReviewDebtPlanResponseV2>('/review/debt/plan', {
    params: filters,
  });
}

export function postReviewDebtRedistribute(): Promise<ReviewDebtSnapshotResponseV2> {
  return api.post<ReviewDebtSnapshotResponseV2>('/review/debt/redistribute');
}

export function postReviewDebtSkipRampup(): Promise<ReviewDebtSnapshotResponseV2> {
  return api.post<ReviewDebtSnapshotResponseV2>('/review/debt/skip-rampup');
}

export function useWeeklySummary(filters: ReviewWeeklySummaryQuery = {}) {
  return useQuery({
    queryKey: weeklyReviewKeys.summary(filters),
    queryFn: () => fetchWeeklySummary(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useReviewDebtSnapshot() {
  return useQuery({
    queryKey: weeklyReviewKeys.debtSnapshot(),
    queryFn: fetchReviewDebtSnapshot,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useReviewDebtPlan(filters: ReviewDebtPlanQuery = {}) {
  return useQuery({
    queryKey: weeklyReviewKeys.debtPlan(filters),
    queryFn: () => fetchReviewDebtPlan(filters),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useTriggerReviewDebtRedistribute(): UseMutationResult<
  ReviewDebtSnapshotResponseV2,
  unknown,
  void
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postReviewDebtRedistribute(),
    retry: false,
    onSuccess: () => {
      invalidateWeeklyReviewQueries(queryClient);
    },
  });
}

export function useSkipReviewDebtRampup(): UseMutationResult<
  ReviewDebtSnapshotResponseV2,
  unknown,
  void
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postReviewDebtSkipRampup(),
    retry: false,
    onSuccess: () => {
      invalidateWeeklyReviewQueries(queryClient);
    },
  });
}
