import { isAxiosError } from 'axios';
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
  AiQuestionFeedbackRequestV2,
  AiQuestionFeedbackResponseV2,
  AiQuestionRequestDetailV2,
  AiQuestionsGenerateRequestV2,
  AiQuestionsGenerateResponseV2,
} from '../types/practice';

export type AiQuestionGenerateErrorKind =
  | 'service_unavailable'
  | 'rate_limited'
  | 'network'
  | 'unknown';

const AI_QUESTION_GENERATE_TIMEOUT_MS = 35_000;

export const aiQuestionsKeys = {
  all: ['ai-questions-v2'] as const,
  request: (requestId: number) => ['ai-questions-v2', 'request', requestId] as const,
} as const;

export function classifyAiQuestionGenerateError(error: unknown): AiQuestionGenerateErrorKind {
  if (!isAxiosError(error)) {
    return 'unknown';
  }
  if (!error.response) {
    return 'network';
  }
  if (error.response.status === 429) {
    return 'rate_limited';
  }
  if (error.response.status === 503) {
    return 'service_unavailable';
  }
  return 'unknown';
}

export function generateAiQuestions(
  payload: AiQuestionsGenerateRequestV2,
  idempotencyKey?: string,
): Promise<AiQuestionsGenerateResponseV2> {
  const { headers } = withIdempotencyHeader(idempotencyKey);
  return api.post<AiQuestionsGenerateResponseV2, AiQuestionsGenerateRequestV2>(
    '/practice/ai-questions/generate',
    payload,
    {
      headers,
      timeout: AI_QUESTION_GENERATE_TIMEOUT_MS,
    },
  );
}

export function fetchAiQuestionRequest(
  requestId: number,
): Promise<AiQuestionRequestDetailV2> {
  return api.get<AiQuestionRequestDetailV2>(`/practice/ai-questions/requests/${requestId}`);
}

export function postAiQuestionFeedback(
  questionId: number,
  payload: AiQuestionFeedbackRequestV2,
): Promise<AiQuestionFeedbackResponseV2> {
  return api.post<AiQuestionFeedbackResponseV2, AiQuestionFeedbackRequestV2>(
    `/practice/ai-questions/${questionId}/feedback`,
    payload,
  );
}

export function useGenerateAiQuestions(): UseMutationResult<
  AiQuestionsGenerateResponseV2,
  unknown,
  { readonly payload: AiQuestionsGenerateRequestV2; readonly idempotencyKey?: string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    AiQuestionsGenerateResponseV2,
    unknown,
    { readonly payload: AiQuestionsGenerateRequestV2; readonly idempotencyKey?: string }
  >({
    mutationFn: ({ payload, idempotencyKey }) => generateAiQuestions(payload, idempotencyKey),
    retry: false,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: aiQuestionsKeys.request(data.requestId) });
    },
  });
}

export function useAiQuestionRequest(
  requestId: number,
): UseQueryResult<AiQuestionRequestDetailV2> {
  return useQuery<AiQuestionRequestDetailV2>({
    queryKey: aiQuestionsKeys.request(requestId),
    queryFn: () => fetchAiQuestionRequest(requestId),
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: requestId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? 2000 : false;
    },
  });
}

export function useAiQuestionFeedback(): UseMutationResult<
  AiQuestionFeedbackResponseV2,
  unknown,
  { readonly questionId: number; readonly payload: AiQuestionFeedbackRequestV2 }
> {
  return useMutation<
    AiQuestionFeedbackResponseV2,
    unknown,
    { readonly questionId: number; readonly payload: AiQuestionFeedbackRequestV2 }
  >({
    mutationFn: ({ questionId, payload }) => postAiQuestionFeedback(questionId, payload),
    retry: false,
  });
}

