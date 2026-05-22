import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { api } from './request';
import type {
  DashboardContinueResponseV2,
  DashboardFullPlanFilters,
  DashboardFullPlanResponseV2,
  DashboardReviewResponseV2,
  DashboardTodayCompletionResponseV2,
  DashboardTodayResponseV2,
  DashboardWeeklyAdjustRequestV2,
  DashboardWeeklyPlanFilters,
  DashboardWeeklyPlanResponseV2,
  OverviewResponseV2,
  PlanReadV2,
} from './types/home';

function invalidateDashboardQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.dashboard.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.plans.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.progress.all() });
}

export function fetchDashboardOverview(): Promise<OverviewResponseV2> {
  return api.get<OverviewResponseV2>('/dashboard/overview');
}

export function fetchDashboardToday(): Promise<DashboardTodayResponseV2> {
  return api.get<DashboardTodayResponseV2>('/dashboard/today');
}

export function fetchDashboardTodayContinue(): Promise<DashboardContinueResponseV2> {
  return api.get<DashboardContinueResponseV2>('/dashboard/today/continue');
}

export function fetchDashboardTodayReview(): Promise<DashboardReviewResponseV2> {
  return api.get<DashboardReviewResponseV2>('/dashboard/today/review');
}

export function fetchDashboardWeeklyPlan(
  filters: DashboardWeeklyPlanFilters = {},
): Promise<DashboardWeeklyPlanResponseV2> {
  return api.get<DashboardWeeklyPlanResponseV2>('/dashboard/weekly-plan', {
    params: filters.anchorDate ? { anchorDate: filters.anchorDate } : undefined,
  });
}

export function fetchDashboardWeeklyGoal(): Promise<PlanReadV2> {
  return api.get<PlanReadV2>('/dashboard/weekly-plan/goal');
}

export function fetchDashboardTodayCompletion(): Promise<DashboardTodayCompletionResponseV2> {
  return api.get<DashboardTodayCompletionResponseV2>('/dashboard/weekly-plan/today-completion');
}

export function updateDashboardWeeklyAdjust(
  payload: DashboardWeeklyAdjustRequestV2,
): Promise<PlanReadV2> {
  return api.put<PlanReadV2, DashboardWeeklyAdjustRequestV2>(
    '/dashboard/weekly-plan/adjust',
    payload,
  );
}

export function fetchDashboardFullPlan(
  filters: DashboardFullPlanFilters,
): Promise<DashboardFullPlanResponseV2> {
  return api.get<DashboardFullPlanResponseV2>('/dashboard/full-plan', {
    params: {
      view: filters.view,
      anchorDate: filters.anchorDate,
    },
  });
}

export function useDashboardOverview(): UseQueryResult<OverviewResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.overview(),
    queryFn: fetchDashboardOverview,
  });
}

export function useDashboardToday(): UseQueryResult<DashboardTodayResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.today(),
    queryFn: fetchDashboardToday,
  });
}

export function useDashboardTodayContinue(): UseQueryResult<DashboardContinueResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.todayContinue(),
    queryFn: fetchDashboardTodayContinue,
  });
}

export function useDashboardTodayReview(): UseQueryResult<DashboardReviewResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.todayReview(),
    queryFn: fetchDashboardTodayReview,
  });
}

export function useDashboardWeeklyPlan(
  filters: DashboardWeeklyPlanFilters = {},
): UseQueryResult<DashboardWeeklyPlanResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.weeklyPlan(filters),
    queryFn: () => fetchDashboardWeeklyPlan(filters),
  });
}

export function useDashboardWeeklyGoal(): UseQueryResult<PlanReadV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.weeklyGoal(),
    queryFn: fetchDashboardWeeklyGoal,
  });
}

export function useDashboardTodayCompletion(): UseQueryResult<DashboardTodayCompletionResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.todayCompletion(),
    queryFn: fetchDashboardTodayCompletion,
  });
}

export function useDashboardFullPlan(
  filters: DashboardFullPlanFilters,
): UseQueryResult<DashboardFullPlanResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.dashboard.fullPlan(filters),
    queryFn: () => fetchDashboardFullPlan(filters),
  });
}

export function useUpdateDashboardWeeklyAdjust(): UseMutationResult<
  PlanReadV2,
  unknown,
  DashboardWeeklyAdjustRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateDashboardWeeklyAdjust,
    onSuccess: () => {
      invalidateDashboardQueries(queryClient);
    },
  });
}
