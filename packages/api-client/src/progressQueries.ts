import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { api } from './request';
import type {
  DashboardProgressResponseV2,
  ProgressDiagnosisResponseV2,
  ProgressTimeseriesFilters,
  ProgressTimeseriesResponseV2,
  ProgressWeaknessResponseV2,
  WeeklyProgressSummaryV2,
} from './types/home';

export function fetchProgressOverview(planId?: number | null): Promise<DashboardProgressResponseV2> {
  return api.get<DashboardProgressResponseV2>('/dashboard/progress', {
    params: planId ? { plan_id: planId } : undefined,
  });
}

export function fetchProgressTimeseries(
  filters: ProgressTimeseriesFilters,
): Promise<ProgressTimeseriesResponseV2> {
  return api.get<ProgressTimeseriesResponseV2>('/dashboard/progress/timeseries', {
    params: {
      from: filters.from,
      to: filters.to,
      granularity: filters.granularity ?? 'day',
    },
  });
}

export function fetchProgressWeakness(): Promise<ProgressWeaknessResponseV2> {
  return api.get<ProgressWeaknessResponseV2>('/dashboard/progress/weakness');
}

export function fetchProgressDiagnosis(): Promise<ProgressDiagnosisResponseV2> {
  return api.get<ProgressDiagnosisResponseV2>('/dashboard/progress/diagnosis');
}

/*
 * fetchProgressWeeklySummary — SIK-122 Topbar (subtitle streak source).
 *
 * Why: Home topbar subtitle wants the user's current streak in days. The
 *      backend already exposes WeeklyProgressSummaryV2.streak_days via
 *      GET /api/v2/progress/weekly (analytics PR-6 schema). We only need
 *      streakDays here, so the type is re-declared narrowly in
 *      types/home.ts to keep the api-client surface minimal.
 *
 *      AGENT-H7: API errors / 0 must not be substituted with placeholders;
 *      the caller decides how to render that case (Home.tsx hides the
 *      streak segment when streakDays is missing or falsy).
 */
export function fetchProgressWeeklySummary(): Promise<WeeklyProgressSummaryV2> {
  return api.get<WeeklyProgressSummaryV2>('/progress/weekly');
}

export function useProgressOverview(
  planId?: number | null,
): UseQueryResult<DashboardProgressResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.progress.overview(planId),
    queryFn: () => fetchProgressOverview(planId),
  });
}

export function useProgressTimeseries(
  filters: ProgressTimeseriesFilters,
): UseQueryResult<ProgressTimeseriesResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.progress.timeseries(filters),
    queryFn: () => fetchProgressTimeseries(filters),
  });
}

export function useProgressWeakness(): UseQueryResult<ProgressWeaknessResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.progress.weakness(),
    queryFn: fetchProgressWeakness,
  });
}

export function useProgressDiagnosis(): UseQueryResult<ProgressDiagnosisResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.progress.diagnosis(),
    queryFn: fetchProgressDiagnosis,
  });
}

/*
 * useProgressWeeklySummary — SIK-122 Topbar.
 *
 * Why: query hook companion to fetchProgressWeeklySummary. Default React
 *      Query retry behaviour fits the failure path: while the request is
 *      in-flight or has failed, query.data is undefined and Home.tsx
 *      simply omits the streak segment (no fabricated default). Cached
 *      under homeQueryKeys.progress so HomeData refresh paths (e.g. plan
 *      mutations that invalidate `progress.all()`) also refresh streak.
 */
export function useProgressWeeklySummary(): UseQueryResult<WeeklyProgressSummaryV2> {
  return useQuery({
    queryKey: homeQueryKeys.progress.weeklySummary(),
    queryFn: fetchProgressWeeklySummary,
  });
}
