import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';
import { api } from '../request';

export interface PracticeRuntimeOptionV2 {
  readonly id: number;
  readonly optionKey: string;
  readonly optionText: string;
  readonly displayOrder: number;
}

export interface PracticeRuntimeQuestionDetailV2 {
  readonly id: number;
  readonly questionId?: number | null;
  readonly questionKind: string;
  readonly stemText: string;
  readonly difficultyCode: string;
  readonly explanationText: string;
  readonly selectionMode: string;
  readonly rendererKey: string;
  readonly options: PracticeRuntimeOptionV2[];
  readonly content?: {
    readonly stem?: string;
    readonly explanation?: string;
  } | null;
}

export const practiceQuestionKeys = {
  all: ['practice-question-detail'] as const,
  detail: (questionId: number) => ['practice-question-detail', questionId] as const,
} as const;

export function fetchPracticeQuestionDetail(
  questionId: number,
): Promise<PracticeRuntimeQuestionDetailV2> {
  return api.get<PracticeRuntimeQuestionDetailV2>(`/questions/${questionId}`);
}

export function usePracticeQuestionDetail(
  questionId: number,
): UseQueryResult<PracticeRuntimeQuestionDetailV2> {
  return useQuery<PracticeRuntimeQuestionDetailV2>({
    queryKey: practiceQuestionKeys.detail(questionId),
    queryFn: () => fetchPracticeQuestionDetail(questionId),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: questionId > 0,
  });
}
