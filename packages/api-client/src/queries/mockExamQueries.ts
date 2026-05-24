import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { withIdempotencyHeader } from '../idempotency';
import { api } from '../request';
import type {
  MockExamComparisonResponseV2,
  MockExamCreateRequestV2,
  MockExamCreateResponseV2,
  MockExamHistoryResponseV2,
} from '../types/practice';

export const mockExamKeys = {
  all: ['mock-exam-v2'] as const,
  history: () => ['mock-exam-v2', 'history'] as const,
  comparison: (sessionId: number) => ['mock-exam-v2', 'comparison', sessionId] as const,
} as const;

export function createMockExam(
  payload: MockExamCreateRequestV2,
  idempotencyKey?: string,
): Promise<MockExamCreateResponseV2> {
  const { headers } = withIdempotencyHeader(idempotencyKey);
  return api.post<MockExamCreateResponseV2, MockExamCreateRequestV2>(
    '/practice/mock-exams',
    payload,
    { headers },
  );
}

export function fetchMockExamHistory(): Promise<MockExamHistoryResponseV2> {
  return api.get<MockExamHistoryResponseV2>('/practice/mock-exams/history');
}

export function fetchMockExamComparison(
  sessionId: number,
): Promise<MockExamComparisonResponseV2> {
  return api.get<MockExamComparisonResponseV2>(`/practice/mock-exams/${sessionId}/comparison`);
}

export function useCreateMockExam(): UseMutationResult<
  MockExamCreateResponseV2,
  unknown,
  { readonly payload: MockExamCreateRequestV2; readonly idempotencyKey?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    MockExamCreateResponseV2,
    unknown,
    { readonly payload: MockExamCreateRequestV2; readonly idempotencyKey?: string }
  >({
    mutationFn: ({ payload, idempotencyKey }) => createMockExam(payload, idempotencyKey),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mockExamKeys.all });
    },
  });
}

export function useMockExamHistory(): UseQueryResult<MockExamHistoryResponseV2> {
  return useQuery<MockExamHistoryResponseV2>({
    queryKey: mockExamKeys.history(),
    queryFn: fetchMockExamHistory,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useMockExamComparison(
  sessionId: number,
): UseQueryResult<MockExamComparisonResponseV2> {
  return useQuery<MockExamComparisonResponseV2>({
    queryKey: mockExamKeys.comparison(sessionId),
    queryFn: () => fetchMockExamComparison(sessionId),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
  });
}

