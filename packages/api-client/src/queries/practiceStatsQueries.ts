import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  PracticeStatsCrossQuery,
  PracticeStatsCrossResponseV2,
  PracticeStatsPercentileQuery,
  PracticeStatsPercentileResponseV2,
  PracticeStatsQuery,
  PracticeStatsRealtimeQuery,
  PracticeStatsResponseV2,
  PracticeStatsTimingQuery,
  PracticeStatsTimingResponseV2,
  PracticeStatsTrendQuery,
  PracticeStatsTrendResponseV2,
} from '../types/practice';

export const practiceStatsKeys = {
  all: ['practice-stats-v2'] as const,
  main: (filters: PracticeStatsQuery) =>
    ['practice-stats-v2', 'main', filters] as const,
  realtime: (filters: PracticeStatsRealtimeQuery) =>
    ['practice-stats-v2', 'realtime', filters] as const,
  trend: (filters: PracticeStatsTrendQuery) =>
    ['practice-stats-v2', 'trend', filters] as const,
  cross: (filters: PracticeStatsCrossQuery) =>
    ['practice-stats-v2', 'cross', filters] as const,
  percentile: (filters: PracticeStatsPercentileQuery) =>
    ['practice-stats-v2', 'percentile', filters] as const,
  timing: (filters: PracticeStatsTimingQuery) =>
    ['practice-stats-v2', 'timing', filters] as const,
} as const;

export function fetchPracticeStats(
  filters: PracticeStatsQuery,
): Promise<PracticeStatsResponseV2> {
  return api.get<PracticeStatsResponseV2>('/practice/stats', {
    params: filters,
  });
}

export function fetchPracticeStatsRealtime(
  filters: PracticeStatsRealtimeQuery,
): Promise<PracticeStatsResponseV2> {
  return api.get<PracticeStatsResponseV2>('/practice/stats/realtime', {
    params: filters,
  });
}

export function fetchPracticeStatsTrend(
  filters: PracticeStatsTrendQuery,
): Promise<PracticeStatsTrendResponseV2> {
  return api.get<PracticeStatsTrendResponseV2>('/practice/stats/trend', {
    params: filters,
  });
}

export function fetchPracticeStatsCross(
  filters: PracticeStatsCrossQuery,
): Promise<PracticeStatsCrossResponseV2> {
  return api.get<PracticeStatsCrossResponseV2>('/practice/stats/cross', {
    params: filters,
  });
}

export function fetchPracticeStatsPercentile(
  filters: PracticeStatsPercentileQuery,
): Promise<PracticeStatsPercentileResponseV2> {
  return api.get<PracticeStatsPercentileResponseV2>('/practice/stats/percentile', {
    params: filters,
  });
}

export function fetchPracticeStatsTiming(
  filters: PracticeStatsTimingQuery,
): Promise<PracticeStatsTimingResponseV2> {
  return api.get<PracticeStatsTimingResponseV2>('/practice/stats/timing', {
    params: filters,
  });
}

export function usePracticeStats(
  filters: PracticeStatsQuery,
): UseQueryResult<PracticeStatsResponseV2> {
  return useQuery<PracticeStatsResponseV2>({
    queryKey: practiceStatsKeys.main(filters),
    queryFn: () => fetchPracticeStats(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeStatsRealtime(
  filters: PracticeStatsRealtimeQuery,
): UseQueryResult<PracticeStatsResponseV2> {
  return useQuery<PracticeStatsResponseV2>({
    queryKey: practiceStatsKeys.realtime(filters),
    queryFn: () => fetchPracticeStatsRealtime(filters),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeStatsTrend(
  filters: PracticeStatsTrendQuery,
): UseQueryResult<PracticeStatsTrendResponseV2> {
  return useQuery<PracticeStatsTrendResponseV2>({
    queryKey: practiceStatsKeys.trend(filters),
    queryFn: () => fetchPracticeStatsTrend(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeStatsCross(
  filters: PracticeStatsCrossQuery,
): UseQueryResult<PracticeStatsCrossResponseV2> {
  return useQuery<PracticeStatsCrossResponseV2>({
    queryKey: practiceStatsKeys.cross(filters),
    queryFn: () => fetchPracticeStatsCross(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeStatsPercentile(
  filters: PracticeStatsPercentileQuery,
): UseQueryResult<PracticeStatsPercentileResponseV2> {
  return useQuery<PracticeStatsPercentileResponseV2>({
    queryKey: practiceStatsKeys.percentile(filters),
    queryFn: () => fetchPracticeStatsPercentile(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeStatsTiming(
  filters: PracticeStatsTimingQuery,
): UseQueryResult<PracticeStatsTimingResponseV2> {
  return useQuery<PracticeStatsTimingResponseV2>({
    queryKey: practiceStatsKeys.timing(filters),
    queryFn: () => fetchPracticeStatsTiming(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}
