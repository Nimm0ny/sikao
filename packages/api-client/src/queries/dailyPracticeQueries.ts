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

export const dailyPracticeKeys = {
  all: ['daily-practice-v2'] as const,
  today: () => ['daily-practice-v2', 'today'] as const,
  history: () => ['daily-practice-v2', 'history'] as const,
} as const;

export function fetchDailyPractice(): Promise<DailyPracticeResponseV2> {
  return api.get<DailyPracticeResponseV2>('/practice/daily');
}

export function fetchDailyPracticeHistory(): Promise<ListDailyPracticeHistoryResponseV2> {
  return api.get<ListDailyPracticeHistoryResponseV2>('/practice/daily/history');
}

export function startDailyPractice(dailyId: number): Promise<PracticeSessionEnvelopeV2> {
  return api.post<PracticeSessionEnvelopeV2>(`/practice/daily/${dailyId}/start`);
}

export function useDailyPractice(): UseQueryResult<DailyPracticeResponseV2> {
  return useQuery<DailyPracticeResponseV2>({
    queryKey: dailyPracticeKeys.today(),
    queryFn: fetchDailyPractice,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useDailyPracticeHistory(): UseQueryResult<ListDailyPracticeHistoryResponseV2> {
  return useQuery<ListDailyPracticeHistoryResponseV2>({
    queryKey: dailyPracticeKeys.history(),
    queryFn: fetchDailyPracticeHistory,
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

