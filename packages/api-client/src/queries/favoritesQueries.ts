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
  QuestionFavoriteCountV2,
  QuestionFavoriteCreateV2,
  QuestionFavoriteItemV2,
  QuestionFavoriteListV2,
} from '../types/practice';

export const favoritesKeys = {
  all: ['practice-favorites-v2'] as const,
  list: () => ['practice-favorites-v2', 'list'] as const,
  count: () => ['practice-favorites-v2', 'count'] as const,
  question: (questionId: number) => ['practice-favorites-v2', 'question', questionId] as const,
} as const;

export function fetchFavorites(): Promise<QuestionFavoriteListV2> {
  return api.get<QuestionFavoriteListV2>('/practice/favorites');
}

export function fetchFavoriteCount(): Promise<QuestionFavoriteCountV2> {
  return api.get<QuestionFavoriteCountV2>('/practice/favorites/count');
}

export function createFavorite(
  questionId: number | string,
  payload: QuestionFavoriteCreateV2,
): Promise<QuestionFavoriteItemV2> {
  const numericQuestionId = toPracticeMutationId(questionId, 'questionId');
  return api.post<QuestionFavoriteItemV2, QuestionFavoriteCreateV2>(
    `/practice/questions/${numericQuestionId}/favorite`,
    payload,
  );
}

export function removeFavorite(questionId: number | string): Promise<QuestionFavoriteItemV2> {
  const numericQuestionId = toPracticeMutationId(questionId, 'questionId');
  return api.delete<QuestionFavoriteItemV2>(`/practice/questions/${numericQuestionId}/favorite`);
}

export function useFavorites(): UseQueryResult<QuestionFavoriteListV2> {
  return useQuery<QuestionFavoriteListV2>({
    queryKey: favoritesKeys.list(),
    queryFn: fetchFavorites,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useFavoriteCount(): UseQueryResult<QuestionFavoriteCountV2> {
  return useQuery<QuestionFavoriteCountV2>({
    queryKey: favoritesKeys.count(),
    queryFn: fetchFavoriteCount,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useToggleFavorite(): UseMutationResult<
  QuestionFavoriteItemV2,
  unknown,
  { readonly questionId: number | string; readonly favorited: boolean; readonly payload?: QuestionFavoriteCreateV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    QuestionFavoriteItemV2,
    unknown,
    { readonly questionId: number | string; readonly favorited: boolean; readonly payload?: QuestionFavoriteCreateV2 }
  >({
    mutationFn: ({ questionId, favorited, payload }) =>
      favorited
        ? removeFavorite(questionId)
        : createFavorite(questionId, payload ?? {}),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.question(toPracticeMutationId(vars.questionId, 'questionId')) });
    },
  });
}
