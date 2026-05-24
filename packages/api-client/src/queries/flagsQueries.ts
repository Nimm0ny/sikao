import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import { toPracticeMutationId } from './practiceId';
import type {
  QuestionFlagCreateV2,
  QuestionFlagItemV2,
  QuestionFlagListV2,
} from '../types/practice';

export const flagsKeys = {
  all: ['practice-flags-v2'] as const,
  list: () => ['practice-flags-v2', 'list'] as const,
  question: (questionId: number) => ['practice-flags-v2', 'question', questionId] as const,
} as const;

export function fetchFlags(): Promise<QuestionFlagListV2> {
  return api.get<QuestionFlagListV2>('/practice/flags');
}

export function createFlag(
  questionId: number | string,
  payload: QuestionFlagCreateV2,
): Promise<QuestionFlagItemV2> {
  const numericQuestionId = toPracticeMutationId(questionId, 'questionId');
  return api.post<QuestionFlagItemV2, QuestionFlagCreateV2>(
    `/practice/questions/${numericQuestionId}/flag`,
    payload,
  );
}

export function removeFlag(questionId: number | string): Promise<QuestionFlagItemV2> {
  const numericQuestionId = toPracticeMutationId(questionId, 'questionId');
  return api.delete<QuestionFlagItemV2>(`/practice/questions/${numericQuestionId}/flag`);
}

export function resolveFlag(questionId: number | string): Promise<QuestionFlagItemV2> {
  const numericQuestionId = toPracticeMutationId(questionId, 'questionId');
  return api.patch<QuestionFlagItemV2>(`/practice/questions/${numericQuestionId}/flag/resolve`);
}

export function useFlags(): UseQueryResult<QuestionFlagListV2> {
  return useQuery<QuestionFlagListV2>({
    queryKey: flagsKeys.list(),
    queryFn: fetchFlags,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useToggleFlag(): UseMutationResult<
  QuestionFlagItemV2,
  unknown,
  { readonly questionId: number | string; readonly flagged: boolean; readonly payload?: QuestionFlagCreateV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    QuestionFlagItemV2,
    unknown,
    { readonly questionId: number | string; readonly flagged: boolean; readonly payload?: QuestionFlagCreateV2 }
  >({
    mutationFn: ({ questionId, flagged, payload }) =>
      flagged
        ? removeFlag(questionId)
        : createFlag(questionId, payload ?? { reason: 'uncertain' }),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: flagsKeys.all });
      void queryClient.invalidateQueries({ queryKey: flagsKeys.question(toPracticeMutationId(vars.questionId, 'questionId')) });
    },
  });
}

export function useResolveFlag(): UseMutationResult<QuestionFlagItemV2, unknown, number | string> {
  const queryClient = useQueryClient();
  return useMutation<QuestionFlagItemV2, unknown, number | string>({
    mutationFn: (questionId) => resolveFlag(questionId),
    retry: false,
    onSuccess: (_data, questionId) => {
      void queryClient.invalidateQueries({ queryKey: flagsKeys.all });
      void queryClient.invalidateQueries({ queryKey: flagsKeys.question(toPracticeMutationId(questionId, 'questionId')) });
    },
  });
}
