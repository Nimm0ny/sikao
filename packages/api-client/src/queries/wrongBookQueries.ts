/**
 * SIKAO Wave 4 Phase 2D · 错题本 7 endpoint React Query keys + hooks.
 *
 * 配 W1 BE bdfe4f2 7 endpoint:
 *   - GET    /api/v2/practice/wrong-questions/summary             (主页 hero 5 stat)
 *   - GET    /api/v2/practice/wrong-questions/graduation-candidates
 *   - PATCH  /api/v2/practice/wrong-questions/{id}/mark-mastered
 *   - POST   /api/v2/practice/wrong-questions/{id}/peek            (扣 peek_count)
 *   - POST   /api/v2/practice/wrong-questions/{id}/submit-bluff    (重做提交 + 蒙对检测)
 *   - GET    /api/v2/practice/smart-review/today                   (4 stat)
 *   - GET    /api/v2/practice/smart-review/next                    (单题推送)
 *
 * Heatmap endpoint + --data-* token 推 Wave 5 (master §3.7 token SSOT 拍板, 待 lhr 批).
 *
 * Fail-Fast (CLAUDE.md §4): shouldRetry 共享 — 4xx 不 retry / 5xx retry 2 次.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import type {
  GraduationCandidate,
  MarkMasteredResult,
  PeekResult,
  SmartReviewNext,
  SmartReviewToday,
  WrongBookSubmitPayload,
  WrongBookSubmitResult,
  WrongBookSummary,
} from '../types/api';

// ── BE 契约类型 (api.generated.ts SSOT) ────────────────────────────────────
export type {
  GraduationCandidate,
  MarkMasteredResult,
  PeekResult,
  SmartReviewNext,
  SmartReviewToday,
  WrongBookSubmitPayload,
  WrongBookSubmitResult,
  WrongBookSummary,
} from '../types/api';

// ── React Query keys (跟 utils/apiQueries.ts wrongBookKeys.all 同根, 改一处) ──
export const wrongBookV2Keys = {
  summary: ['wrong-book', 'summary'] as const,
  graduation: (limit: number) =>
    ['wrong-book', 'graduation', limit] as const,
  smartReviewToday: ['smart-review', 'today'] as const,
  smartReviewNext: ['smart-review', 'next'] as const,
} as const;

// ── fetchers ───────────────────────────────────────────────────────────────
export function fetchWrongBookSummary(): Promise<WrongBookSummary> {
  return api.get<WrongBookSummary>('/practice/wrong-questions/summary');
}

export function fetchGraduationCandidates(
  limit = 10,
): Promise<GraduationCandidate[]> {
  return api.get<GraduationCandidate[]>(
    '/practice/wrong-questions/graduation-candidates',
    { params: { limit } },
  );
}

export function markWrongQuestionMastered(
  questionId: number,
): Promise<MarkMasteredResult> {
  return api.patch<MarkMasteredResult>(
    `/practice/wrong-questions/${questionId}/mark-mastered`,
  );
}

export function peekWrongQuestion(questionId: number): Promise<PeekResult> {
  return api.post<PeekResult>(`/practice/wrong-questions/${questionId}/peek`);
}

export function submitWrongQuestionWithBluff(
  questionId: number,
  payload: WrongBookSubmitPayload,
): Promise<WrongBookSubmitResult> {
  return api.post<WrongBookSubmitResult, WrongBookSubmitPayload>(
    `/practice/wrong-questions/${questionId}/submit-bluff`,
    payload,
  );
}

export function fetchSmartReviewToday(): Promise<SmartReviewToday> {
  return api.get<SmartReviewToday>('/practice/smart-review/today');
}

export function fetchSmartReviewNext(): Promise<SmartReviewNext> {
  return api.get<SmartReviewNext>('/practice/smart-review/next');
}

// ── hooks ──────────────────────────────────────────────────────────────────
export function useWrongBookSummary(): UseQueryResult<WrongBookSummary> {
  return useQuery<WrongBookSummary>({
    queryKey: wrongBookV2Keys.summary,
    queryFn: fetchWrongBookSummary,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useGraduationCandidates(
  limit = 10,
): UseQueryResult<GraduationCandidate[]> {
  return useQuery<GraduationCandidate[]>({
    queryKey: wrongBookV2Keys.graduation(limit),
    queryFn: () => fetchGraduationCandidates(limit),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

interface MarkMasteredVars {
  readonly questionId: number;
}

export function useMarkMastered(): UseMutationResult<
  MarkMasteredResult,
  unknown,
  MarkMasteredVars
> {
  const queryClient = useQueryClient();
  return useMutation<MarkMasteredResult, unknown, MarkMasteredVars>({
    mutationFn: ({ questionId }) => markWrongQuestionMastered(questionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wrong-book'] });
    },
    retry: false,
  });
}

export function usePeekWrongQuestion(): UseMutationResult<
  PeekResult,
  unknown,
  number
> {
  return useMutation<PeekResult, unknown, number>({
    mutationFn: (questionId) => peekWrongQuestion(questionId),
    retry: false,
  });
}

interface SubmitBluffVars {
  readonly questionId: number;
  readonly payload: WrongBookSubmitPayload;
}

export function useSubmitWithBluff(): UseMutationResult<
  WrongBookSubmitResult,
  unknown,
  SubmitBluffVars
> {
  const queryClient = useQueryClient();
  return useMutation<WrongBookSubmitResult, unknown, SubmitBluffVars>({
    mutationFn: ({ questionId, payload }) =>
      submitWrongQuestionWithBluff(questionId, payload),
    onSuccess: () => {
      // submit 后影响 mastery / summary / graduation 候选 / smart-review queue,
      // 全部失效 (wrong-book + smart-review 双根).
      void queryClient.invalidateQueries({ queryKey: ['wrong-book'] });
      void queryClient.invalidateQueries({ queryKey: ['smart-review'] });
    },
    retry: false,
  });
}

export function useSmartReviewToday(): UseQueryResult<SmartReviewToday> {
  return useQuery<SmartReviewToday>({
    queryKey: wrongBookV2Keys.smartReviewToday,
    queryFn: fetchSmartReviewToday,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useSmartReviewNext(): UseQueryResult<SmartReviewNext> {
  return useQuery<SmartReviewNext>({
    queryKey: wrongBookV2Keys.smartReviewNext,
    queryFn: fetchSmartReviewNext,
    // 不缓存 — 每次 mount 都拉新题; 但 5xx 重试沿用 shouldRetry.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    // 404 没题时 BE 返 errors.ResourceNotFoundError → axios 4xx → shouldRetry false.
    // caller 通过 query.isError + isAuthError 区分 401 vs 真空集合.
  });
}
