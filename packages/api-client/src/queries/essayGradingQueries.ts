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
  EssayGradingResponseV2,
  EssayReferenceAnswerEnvelopeV2,
  EssayReferenceReportRequestV2,
} from '../types/practice';

export const essayGradingKeys = {
  all: ['essay-grading-v2'] as const,
  grading: (submissionId: number) => ['essay-grading-v2', 'grading', submissionId] as const,
  result: (submissionId: number) => ['essay-grading-v2', 'result', submissionId] as const,
  referenceAnswers: (questionId: number) =>
    ['essay-grading-v2', 'reference-answers', questionId] as const,
} as const;

export function getEssayGradingPollInterval(attempt: number): number {
  if (attempt <= 1) return 1000;
  if (attempt <= 4) return 5000;
  return 10000;
}

export function triggerEssayGrading(
  submissionId: number,
  idempotencyKey?: string,
): Promise<EssayGradingResponseV2> {
  const { headers } = withIdempotencyHeader(idempotencyKey);
  return api.post<EssayGradingResponseV2>(
    `/practice/essay/submissions/${submissionId}/grade`,
    undefined,
    { headers },
  );
}

export function fetchEssayGradingStatus(
  submissionId: number,
): Promise<EssayGradingResponseV2> {
  return api.get<EssayGradingResponseV2>(
    `/practice/essay/submissions/${submissionId}/grading-status`,
  );
}

export function fetchEssayGradingResult(
  submissionId: number,
): Promise<EssayGradingResponseV2> {
  return api.get<EssayGradingResponseV2>(`/practice/essay/submissions/${submissionId}/result`);
}

export function fetchEssayReferenceAnswers(
  questionId: number,
): Promise<EssayReferenceAnswerEnvelopeV2[]> {
  return api.get<EssayReferenceAnswerEnvelopeV2[]>(
    `/practice/essay/questions/${questionId}/reference-answers`,
  );
}

export function generateEssayReferenceAnswer(
  questionId: number,
  idempotencyKey?: string,
): Promise<EssayReferenceAnswerEnvelopeV2> {
  const { headers } = withIdempotencyHeader(idempotencyKey);
  return api.post<EssayReferenceAnswerEnvelopeV2, { questionId: number }>(
    '/practice/essay/reference-answers/generate',
    { questionId },
    { headers },
  );
}

export function favoriteEssayReference(
  referenceId: number,
  favorited: boolean,
): Promise<EssayReferenceAnswerEnvelopeV2> {
  return favorited
    ? api.delete<EssayReferenceAnswerEnvelopeV2>(`/practice/essay/reference-answers/${referenceId}/favorite`)
    : api.post<EssayReferenceAnswerEnvelopeV2>(`/practice/essay/reference-answers/${referenceId}/favorite`);
}

export function likeEssayReference(
  referenceId: number,
  liked: boolean,
): Promise<EssayReferenceAnswerEnvelopeV2> {
  return liked
    ? api.delete<EssayReferenceAnswerEnvelopeV2>(`/practice/essay/reference-answers/${referenceId}/like`)
    : api.post<EssayReferenceAnswerEnvelopeV2>(`/practice/essay/reference-answers/${referenceId}/like`);
}

export function reportEssayReference(
  referenceId: number,
  payload: EssayReferenceReportRequestV2,
): Promise<EssayReferenceAnswerEnvelopeV2> {
  return api.post<EssayReferenceAnswerEnvelopeV2, EssayReferenceReportRequestV2>(
    `/practice/essay/reference-answers/${referenceId}/report`,
    payload,
  );
}

export function useTriggerEssayGrading(): UseMutationResult<
  EssayGradingResponseV2,
  unknown,
  { readonly submissionId: number; readonly idempotencyKey?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    EssayGradingResponseV2,
    unknown,
    { readonly submissionId: number; readonly idempotencyKey?: string }
  >({
    mutationFn: ({ submissionId, idempotencyKey }) => triggerEssayGrading(submissionId, idempotencyKey),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.grading(vars.submissionId) });
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.result(vars.submissionId) });
    },
  });
}

export function useEssayGradingStatus(
  submissionId: number,
): UseQueryResult<EssayGradingResponseV2> {
  return useQuery<EssayGradingResponseV2>({
    queryKey: essayGradingKeys.grading(submissionId),
    queryFn: () => fetchEssayGradingStatus(submissionId),
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: submissionId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status !== 'pending' && status !== 'processing') {
        return false;
      }
      return getEssayGradingPollInterval(query.state.dataUpdateCount);
    },
  });
}

export function useEssayGradingResult(
  submissionId: number,
): UseQueryResult<EssayGradingResponseV2> {
  return useQuery<EssayGradingResponseV2>({
    queryKey: essayGradingKeys.result(submissionId),
    queryFn: () => fetchEssayGradingResult(submissionId),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: submissionId > 0,
  });
}

export function useEssayReferenceAnswers(
  questionId: number,
): UseQueryResult<EssayReferenceAnswerEnvelopeV2[]> {
  return useQuery<EssayReferenceAnswerEnvelopeV2[]>({
    queryKey: essayGradingKeys.referenceAnswers(questionId),
    queryFn: () => fetchEssayReferenceAnswers(questionId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: questionId > 0,
  });
}

export function useGenerateEssayReferenceAnswer(): UseMutationResult<
  EssayReferenceAnswerEnvelopeV2,
  unknown,
  { readonly questionId: number; readonly idempotencyKey?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    EssayReferenceAnswerEnvelopeV2,
    unknown,
    { readonly questionId: number; readonly idempotencyKey?: string }
  >({
    mutationFn: ({ questionId, idempotencyKey }) =>
      generateEssayReferenceAnswer(questionId, idempotencyKey),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.referenceAnswers(vars.questionId) });
    },
  });
}

export function useToggleEssayReferenceFavorite(): UseMutationResult<
  EssayReferenceAnswerEnvelopeV2,
  unknown,
  { readonly referenceId: number; readonly favorited: boolean; readonly questionId: number }
> {
  const queryClient = useQueryClient();
  return useMutation<
    EssayReferenceAnswerEnvelopeV2,
    unknown,
    { readonly referenceId: number; readonly favorited: boolean; readonly questionId: number }
  >({
    mutationFn: ({ referenceId, favorited }) => favoriteEssayReference(referenceId, favorited),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.referenceAnswers(vars.questionId) });
    },
  });
}

export function useToggleEssayReferenceLike(): UseMutationResult<
  EssayReferenceAnswerEnvelopeV2,
  unknown,
  { readonly referenceId: number; readonly liked: boolean; readonly questionId: number }
> {
  const queryClient = useQueryClient();
  return useMutation<
    EssayReferenceAnswerEnvelopeV2,
    unknown,
    { readonly referenceId: number; readonly liked: boolean; readonly questionId: number }
  >({
    mutationFn: ({ referenceId, liked }) => likeEssayReference(referenceId, liked),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.referenceAnswers(vars.questionId) });
    },
  });
}

export function useReportEssayReference(): UseMutationResult<
  EssayReferenceAnswerEnvelopeV2,
  unknown,
  { readonly referenceId: number; readonly questionId: number; readonly payload: EssayReferenceReportRequestV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    EssayReferenceAnswerEnvelopeV2,
    unknown,
    { readonly referenceId: number; readonly questionId: number; readonly payload: EssayReferenceReportRequestV2 }
  >({
    mutationFn: ({ referenceId, payload }) => reportEssayReference(referenceId, payload),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: essayGradingKeys.referenceAnswers(vars.questionId) });
    },
  });
}

