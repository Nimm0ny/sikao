import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { api } from './request';
import type {
  DashboardProgressResponseV2,
  ProgressDiagnosisResponseV2,
  ProgressTimeseriesFilters,
  ProgressTimeseriesResponseV2,
  ProgressWeaknessResponseV2,
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
