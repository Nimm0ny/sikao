import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  DailyPracticeResponseV2,
  ListDailyPracticeHistoryResponseV2,
  PracticeSessionEnvelopeV2,
} from '../types/practice';

export type DailyPracticeType = 'xingce' | 'essay';

export interface DailyPracticeHistoryFilters {
  readonly type?: DailyPracticeType;
  readonly period?: '7d' | '30d';
}

export const dailyPracticeKeys = {
  all: ['daily-practice-v2'] as const,
  today: (type: DailyPracticeType) => ['daily-practice-v2', 'today', type] as const,
  history: (filters: DailyPracticeHistoryFilters = {}) => ['daily-practice-v2', 'history', filters] as const,
} as const;

export function fetchDailyPractice(type: DailyPracticeType): Promise<DailyPracticeResponseV2> {
  return api.get<DailyPracticeResponseV2>('/practice/daily', {
    params: { type },
  });
}

export function fetchDailyPracticeHistory(
  filters: DailyPracticeHistoryFilters = {},
): Promise<ListDailyPracticeHistoryResponseV2> {
  return api.get<ListDailyPracticeHistoryResponseV2>('/practice/daily/history', {
    params: filters,
  });
}

export function startDailyPractice(dailyId: number): Promise<PracticeSessionEnvelopeV2> {
  return api.post<PracticeSessionEnvelopeV2>(`/practice/daily/${dailyId}/start`);
}

export function useDailyPractice(type: DailyPracticeType): UseQueryResult<DailyPracticeResponseV2> {
  return useQuery<DailyPracticeResponseV2>({
    queryKey: dailyPracticeKeys.today(type),
    queryFn: () => fetchDailyPractice(type),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: type === 'xingce' || type === 'essay',
  });
}

export function useDailyPracticeHistory(
  filters: DailyPracticeHistoryFilters = {},
): UseQueryResult<ListDailyPracticeHistoryResponseV2> {
  return useQuery<ListDailyPracticeHistoryResponseV2>({
    queryKey: dailyPracticeKeys.history(filters),
    queryFn: () => fetchDailyPracticeHistory(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useStartDailyPractice(): UseMutationResult<
  PracticeSessionEnvelopeV2,
  unknown,
  number
> {
  const queryClient = useQueryClient();
  return useMutation<PracticeSessionEnvelopeV2, unknown, number>({
    mutationFn: (dailyId) => startDailyPractice(dailyId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dailyPracticeKeys.all });
    },
  });
}
