import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { withIdempotencyHeader } from './idempotency';
import { api } from './request';
import type {
  RecommendationAcceptRequestV2,
  RecommendationAcceptResponseV2,
  RecommendationHistoryFilters,
  RecommendationListResponseV2,
  RecommendationRejectRequestV2,
} from './types/home';

function invalidateRecommendationQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.recommendations.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.dashboard.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.plans.all() });
}

export function fetchRecommendationsToday(): Promise<RecommendationListResponseV2> {
  return api.get<RecommendationListResponseV2>('/recommendations/today');
}

export function fetchRecommendationsHistory(
  filters: RecommendationHistoryFilters = {},
): Promise<RecommendationListResponseV2> {
  return api.get<RecommendationListResponseV2>('/recommendations/history', {
    params: {
      from_date: filters.from,
      to_date: filters.to,
    },
  });
}

export function refreshRecommendations(
  payload: Record<string, unknown> = {},
  idempotencyKey?: string,
): Promise<RecommendationListResponseV2> {
  const { headers } = withIdempotencyHeader(idempotencyKey);
  return api.post<RecommendationListResponseV2, Record<string, unknown>>(
    '/recommendations/refresh',
    payload,
    { headers },
  );
}

export function acceptRecommendation(
  recommendationId: number,
  payload: RecommendationAcceptRequestV2,
): Promise<RecommendationAcceptResponseV2> {
  return api.post<RecommendationAcceptResponseV2, RecommendationAcceptRequestV2>(
    `/recommendations/${recommendationId}/accept`,
    payload,
  );
}

export function rejectRecommendation(
  recommendationId: number,
  payload: RecommendationRejectRequestV2,
): Promise<{ ok: boolean; status: string }> {
  return api.post<{ ok: boolean; status: string }, RecommendationRejectRequestV2>(
    `/recommendations/${recommendationId}/reject`,
    payload,
  );
}

export function useRecommendationsToday(): UseQueryResult<RecommendationListResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.recommendations.today(),
    queryFn: fetchRecommendationsToday,
  });
}

export function useRecommendationsHistory(
  filters: RecommendationHistoryFilters = {},
): UseQueryResult<RecommendationListResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.recommendations.history(filters),
    queryFn: () => fetchRecommendationsHistory(filters),
  });
}

export function useRefreshRecommendations(): UseMutationResult<
  RecommendationListResponseV2,
  unknown,
  { readonly payload?: Record<string, unknown>; readonly idempotencyKey?: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables) =>
      refreshRecommendations(variables.payload ?? {}, variables.idempotencyKey),
    onSuccess: () => {
      invalidateRecommendationQueries(queryClient);
    },
  });
}

export function useAcceptRecommendation(
  recommendationId: number,
): UseMutationResult<RecommendationAcceptResponseV2, unknown, RecommendationAcceptRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => acceptRecommendation(recommendationId, payload),
    onSuccess: () => {
      invalidateRecommendationQueries(queryClient);
    },
  });
}

export function useRejectRecommendation(
  recommendationId: number,
): UseMutationResult<{ ok: boolean; status: string }, unknown, RecommendationRejectRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => rejectRecommendation(recommendationId, payload),
    onSuccess: () => {
      invalidateRecommendationQueries(queryClient);
    },
  });
}
