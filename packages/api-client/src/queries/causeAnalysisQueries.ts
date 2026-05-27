import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  CauseAnalysisFeedbackRequestV2,
  CauseAnalysisGroupRequestV2,
  CauseAnalysisRequestV2,
  CauseAnalysisResponseV2,
  CauseDimensionOverrideRequestV2,
  CauseTagListResponseV2,
  ReviewCauseAnalysisFeedbackResponseV2,
  ReviewCauseAnalysisGroupResponseV2,
  ReviewCauseAnalysisOverrideResponseV2,
  ReviewCauseAnalysisSingleResponseV2,
} from '../types/review';

export const causeAnalysisKeys = {
  all: ['review-cause-v2'] as const,
  tags: () => ['review-cause-v2', 'tags'] as const,
  single: (itemId: number, mode: CauseAnalysisRequestV2['mode']) =>
    ['review-cause-v2', 'single', itemId, mode] as const,
  group: (signature: string) => ['review-cause-v2', 'group', signature] as const,
} as const;

function invalidateCauseAnalysisQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: causeAnalysisKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['review-v2'] });
}

export function fetchCauseTags(): Promise<CauseTagListResponseV2> {
  return api.get<CauseTagListResponseV2>('/review/cause-tags');
}

export function createCauseAnalysisSingle(
  itemId: number,
  payload: CauseAnalysisRequestV2,
): Promise<ReviewCauseAnalysisSingleResponseV2> {
  return api.post<ReviewCauseAnalysisSingleResponseV2, CauseAnalysisRequestV2>(
    `/review/items/${itemId}/cause-analysis`,
    payload,
  );
}

export function createCauseAnalysisGroup(
  payload: CauseAnalysisGroupRequestV2,
): Promise<ReviewCauseAnalysisGroupResponseV2> {
  return api.post<ReviewCauseAnalysisGroupResponseV2, CauseAnalysisGroupRequestV2>(
    '/review/cause-analysis/group',
    payload,
  );
}

export function patchCauseAnalysisDimension(
  analysisId: number,
  dimensionIndex: number,
  payload: CauseDimensionOverrideRequestV2,
): Promise<ReviewCauseAnalysisOverrideResponseV2> {
  return api.patch<ReviewCauseAnalysisOverrideResponseV2, CauseDimensionOverrideRequestV2>(
    `/review/cause-analysis/${analysisId}/dimensions/${dimensionIndex}`,
    payload,
  );
}

export function postCauseAnalysisFeedback(
  analysisId: number,
  payload: CauseAnalysisFeedbackRequestV2,
): Promise<ReviewCauseAnalysisFeedbackResponseV2> {
  return api.post<ReviewCauseAnalysisFeedbackResponseV2, CauseAnalysisFeedbackRequestV2>(
    `/review/cause-analysis/${analysisId}/feedback`,
    payload,
  );
}

export function useCauseTags() {
  return useQuery({
    queryKey: causeAnalysisKeys.tags(),
    queryFn: fetchCauseTags,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useCreateCauseAnalysisSingle(
  itemId: number,
): UseMutationResult<ReviewCauseAnalysisSingleResponseV2, unknown, CauseAnalysisRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createCauseAnalysisSingle(itemId, payload),
    retry: false,
    onSuccess: () => {
      invalidateCauseAnalysisQueries(queryClient);
    },
  });
}

export function useCreateCauseAnalysisGroup(): UseMutationResult<
  ReviewCauseAnalysisGroupResponseV2,
  unknown,
  CauseAnalysisGroupRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCauseAnalysisGroup,
    retry: false,
    onSuccess: () => {
      invalidateCauseAnalysisQueries(queryClient);
    },
  });
}

export function usePatchCauseAnalysisDimension(
  analysisId: number,
  dimensionIndex: number,
): UseMutationResult<ReviewCauseAnalysisOverrideResponseV2, unknown, CauseDimensionOverrideRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => patchCauseAnalysisDimension(analysisId, dimensionIndex, payload),
    retry: false,
    onSuccess: () => {
      invalidateCauseAnalysisQueries(queryClient);
    },
  });
}

export function usePostCauseAnalysisFeedback(
  analysisId: number,
): UseMutationResult<ReviewCauseAnalysisFeedbackResponseV2, unknown, CauseAnalysisFeedbackRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => postCauseAnalysisFeedback(analysisId, payload),
    retry: false,
    onSuccess: () => {
      invalidateCauseAnalysisQueries(queryClient);
    },
  });
}

export function buildCauseAnalysisGroupSignature(
  questionIds: readonly number[],
  mode: CauseAnalysisRequestV2['mode'] | 'group' = 'group',
): string {
  const sortedIds = [...questionIds].sort((left, right) => left - right);
  return `${mode}:${sortedIds.join(',')}`;
}

export function isCauseAnalysisResponse(value: unknown): value is CauseAnalysisResponseV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    'analysisId' in value &&
    'result' in value
  );
}
