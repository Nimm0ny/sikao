import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  DashboardReviewResponseV2,
  OverviewResponseV2,
  PracticeAnswerFeedResponseV2,
  ReviewAddToPlanResponseV2,
  ReviewArchiveResponseV2,
  ReviewAttemptRequestV2,
  ReviewAttemptResponseV2,
  ReviewBatchRequestV2,
  ReviewBatchResponseV2,
  ReviewCreateRequestV2,
  ReviewCreateResponseV2,
  ReviewDetailResponseV2,
  ReviewGraduateResponseV2,
  ReviewInsightsCausesQuery,
  ReviewInsightsCausesResponseV2,
  ReviewInsightsRedoAccuracyQuery,
  ReviewInsightsRedoAccuracyResponseV2,
  ReviewInsightsTrendsQuery,
  ReviewInsightsTrendsResponseV2,
  ReviewItemsQuery,
  ReviewListResponseV2,
  ReviewRedoResponseV2,
  ReviewRestoreResponseV2,
} from '../types/review';

export const reviewKeys = {
  all: ['review-v2'] as const,
  today: () => ['review-v2', 'today'] as const,
  smart: () => ['review-v2', 'smart'] as const,
  items: (filters: ReviewItemsQuery = {}) => ['review-v2', 'items', filters] as const,
  item: (itemId: number) => ['review-v2', 'item', itemId] as const,
  insightsAll: () => ['review-v2', 'insights'] as const,
  insightsTrends: (filters: ReviewInsightsTrendsQuery = {}) =>
    ['review-v2', 'insights', 'trends', filters] as const,
  insightsCauses: (filters: ReviewInsightsCausesQuery = {}) =>
    ['review-v2', 'insights', 'causes', filters] as const,
  insightsRedoAccuracy: (filters: ReviewInsightsRedoAccuracyQuery = {}) =>
    ['review-v2', 'insights', 'redo-accuracy', filters] as const,
  recentAnswers: (limit: number, includeConfidence: boolean, includeDuration: boolean) =>
    ['review-v2', 'recent-answers', { limit, includeConfidence, includeDuration }] as const,
} as const;

function invalidateReviewQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
}

export function fetchDashboardTodayReview(): Promise<DashboardReviewResponseV2> {
  return api.get<DashboardReviewResponseV2>('/dashboard/today/review');
}

export function fetchSmartReview(): Promise<OverviewResponseV2> {
  return api.get<OverviewResponseV2>('/review/smart');
}

export function fetchReviewItems(filters: ReviewItemsQuery = {}): Promise<ReviewListResponseV2> {
  return api.get<ReviewListResponseV2>('/review/items', { params: filters });
}

export function buildReviewItemsQueryOptions(filters: ReviewItemsQuery = {}) {
  return {
    queryKey: reviewKeys.items(filters),
    queryFn: () => fetchReviewItems(filters),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  } as const;
}

export function fetchReviewItem(itemId: number): Promise<ReviewDetailResponseV2> {
  return api.get<ReviewDetailResponseV2>(`/review/items/${itemId}`);
}

export function createReviewItem(payload: ReviewCreateRequestV2): Promise<ReviewCreateResponseV2> {
  return api.post<ReviewCreateResponseV2, ReviewCreateRequestV2>('/review/items', payload);
}

export function batchReviewItems(payload: ReviewBatchRequestV2): Promise<ReviewBatchResponseV2> {
  return api.post<ReviewBatchResponseV2, ReviewBatchRequestV2>('/review/items/batch', payload);
}

export function graduateReviewItem(itemId: number): Promise<ReviewGraduateResponseV2> {
  return api.patch<ReviewGraduateResponseV2>(`/review/items/${itemId}/graduate`);
}

export function archiveReviewItem(itemId: number): Promise<ReviewArchiveResponseV2> {
  return api.patch<ReviewArchiveResponseV2>(`/review/items/${itemId}/archive`);
}

export function restoreReviewItem(itemId: number): Promise<ReviewRestoreResponseV2> {
  return api.patch<ReviewRestoreResponseV2>(`/review/items/${itemId}/restore`);
}

export function redoReviewItem(itemId: number): Promise<ReviewRedoResponseV2> {
  return api.post<ReviewRedoResponseV2>(`/review/items/${itemId}/redo`);
}

export function addReviewItemToPlan(itemId: number): Promise<ReviewAddToPlanResponseV2> {
  return api.post<ReviewAddToPlanResponseV2>(`/review/items/${itemId}/add-to-plan`);
}

export function submitReviewAttempt(
  itemId: number,
  payload: ReviewAttemptRequestV2,
): Promise<ReviewAttemptResponseV2> {
  return api.post<ReviewAttemptResponseV2, ReviewAttemptRequestV2>(
    `/review/items/${itemId}/attempt`,
    payload,
  );
}

export function fetchReviewInsightsTrends(
  filters: ReviewInsightsTrendsQuery = {},
): Promise<ReviewInsightsTrendsResponseV2> {
  return api.get<ReviewInsightsTrendsResponseV2>('/review/insights/trends', { params: filters });
}

export function fetchReviewInsightsCauses(
  filters: ReviewInsightsCausesQuery = {},
): Promise<ReviewInsightsCausesResponseV2> {
  return api.get<ReviewInsightsCausesResponseV2>('/review/insights/causes', { params: filters });
}

export function fetchReviewInsightsRedoAccuracy(
  filters: ReviewInsightsRedoAccuracyQuery = {},
): Promise<ReviewInsightsRedoAccuracyResponseV2> {
  return api.get<ReviewInsightsRedoAccuracyResponseV2>('/review/insights/redo-accuracy', {
    params: filters,
  });
}

export function fetchRecentPracticeAnswers(
  {
    limit = 200,
    includeConfidence = true,
    includeDuration = true,
  }: {
    readonly limit?: number;
    readonly includeConfidence?: boolean;
    readonly includeDuration?: boolean;
  } = {},
): Promise<PracticeAnswerFeedResponseV2> {
  return api.get<PracticeAnswerFeedResponseV2>('/practice/answers', {
    params: {
      limit,
      include_confidence: includeConfidence,
      include_duration: includeDuration,
    },
  });
}

export function useDashboardTodayReview() {
  return useQuery({
    queryKey: reviewKeys.today(),
    queryFn: fetchDashboardTodayReview,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useSmartReviewOverview() {
  return useQuery({
    queryKey: reviewKeys.smart(),
    queryFn: fetchSmartReview,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useReviewItemsQuery(filters: ReviewItemsQuery = {}) {
  return useQuery(buildReviewItemsQueryOptions(filters));
}

export function useReviewItemQuery(itemId: number) {
  return useQuery({
    queryKey: reviewKeys.item(itemId),
    queryFn: () => fetchReviewItem(itemId),
    enabled: itemId > 0,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useCreateReviewItem(): UseMutationResult<
  ReviewCreateResponseV2,
  unknown,
  ReviewCreateRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReviewItem,
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useBatchReviewItems(): UseMutationResult<
  ReviewBatchResponseV2,
  unknown,
  ReviewBatchRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchReviewItems,
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useGraduateReviewItem(
  itemId: number,
): UseMutationResult<ReviewGraduateResponseV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => graduateReviewItem(itemId),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useArchiveReviewItem(
  itemId: number,
): UseMutationResult<ReviewArchiveResponseV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archiveReviewItem(itemId),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useRestoreReviewItem(
  itemId: number,
): UseMutationResult<ReviewRestoreResponseV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => restoreReviewItem(itemId),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useRedoReviewItem(
  itemId: number,
): UseMutationResult<ReviewRedoResponseV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => redoReviewItem(itemId),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useAddReviewItemToPlan(
  itemId: number,
): UseMutationResult<ReviewAddToPlanResponseV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => addReviewItemToPlan(itemId),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useSubmitReviewAttempt(
  itemId: number,
): UseMutationResult<ReviewAttemptResponseV2, unknown, ReviewAttemptRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => submitReviewAttempt(itemId, payload),
    retry: false,
    onSuccess: () => {
      invalidateReviewQueries(queryClient);
    },
  });
}

export function useReviewInsightsTrends(filters: ReviewInsightsTrendsQuery = {}) {
  return useQuery({
    queryKey: reviewKeys.insightsTrends(filters),
    queryFn: () => fetchReviewInsightsTrends(filters),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useReviewInsightsCauses(filters: ReviewInsightsCausesQuery = {}) {
  return useQuery({
    queryKey: reviewKeys.insightsCauses(filters),
    queryFn: () => fetchReviewInsightsCauses(filters),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useReviewInsightsRedoAccuracy(filters: ReviewInsightsRedoAccuracyQuery = {}) {
  return useQuery({
    queryKey: reviewKeys.insightsRedoAccuracy(filters),
    queryFn: () => fetchReviewInsightsRedoAccuracy(filters),
    staleTime: 60_000,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useRecentPracticeAnswersQuery(
  options: {
    readonly limit?: number;
    readonly includeConfidence?: boolean;
    readonly includeDuration?: boolean;
  } = {},
) {
  const limit = options.limit ?? 200;
  const includeConfidence = options.includeConfidence ?? true;
  const includeDuration = options.includeDuration ?? true;
  return useQuery({
    queryKey: reviewKeys.recentAnswers(limit, includeConfidence, includeDuration),
    queryFn: () =>
      fetchRecentPracticeAnswers({
        limit,
        includeConfidence,
        includeDuration,
      }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}
