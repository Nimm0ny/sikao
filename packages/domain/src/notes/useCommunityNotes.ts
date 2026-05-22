/**
 * SIKAO Wave 10 Phase D · Community notes React Query hooks.
 *
 * Wave 10 Phase B BE endpoint (ac87f2f) 已 ship — Phase C 的 mock 全切真:
 *   - GET  /api/v2/questions/{id}/public-notes      → useCommunityNotesForQuestion
 *   - GET  /api/v2/notebook/notes/{id}/comments     → useCommunityNoteComments
 *   - POST /api/v2/notebook/notes/{id}/comments     → useCreateNoteComment
 *   - POST /api/v2/notebook/notes/{id}/likes        → useToggleLike
 *   - POST /api/v2/notebook/notes/{id}/favorites    → useToggleFavorite
 *
 * 数据流模式 mirror notebookQueries.ts (Wave 4 Phase 2D ship):
 *   - useQuery 走 shouldRetry (全 4xx fail-fast, 5xx retry 2 次)
 *   - mutation 不 retry, 失败抛给 caller view (toast / ErrorBoundary)
 *   - mutation onSuccess invalidate 命中的 community-notes / community-comments key
 *
 * Fail-Fast (frontend/CLAUDE.md §3.1): error 不 silent fallback. caller 必须
 * 处理 isError / mutation error.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import { shouldRetry } from '@sikao/shared-utils';
import type {
  CommunityNoteComment,
  CommunityNoteCommentCreate,
  CommunityNoteCommentList,
  CommunityNoteFavoriteToggleResponse,
  CommunityNoteLikeToggleResponse,
  CommunityNoteListResponse,
} from '@sikao/api-client/types/api';

// ── re-export schema 类型 (替 Phase C _communityNotesMock 静态 type) ────────

export type {
  CommunityNote,
  CommunityNoteComment,
  CommunityNoteCommentCreate,
  CommunityNoteCommentList,
  CommunityNoteFavoriteToggleResponse,
  CommunityNoteLikeToggleResponse,
  CommunityNoteListResponse,
} from '@sikao/api-client/types/api';

// ── React Query keys ──────────────────────────────────────────────────────

export const communityNotesKeys = {
  all: ['community-notes'] as const,
  forQuestion: (questionId: number, limit: number) =>
    ['community-notes', 'for-question', questionId, limit] as const,
  comments: (noteId: number) =>
    ['community-notes', 'comments', noteId] as const,
} as const;

// ── fetchers ──────────────────────────────────────────────────────────────

function fetchPublicNotesForQuestion(
  questionId: number,
  limit: number,
): Promise<CommunityNoteListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  return api.get<CommunityNoteListResponse>(
    `/questions/${questionId}/public-notes?${params.toString()}`,
  );
}

function fetchComments(noteId: number): Promise<CommunityNoteCommentList> {
  return api.get<CommunityNoteCommentList>(
    `/notebook/notes/${noteId}/comments`,
  );
}

// ── queries ───────────────────────────────────────────────────────────────

/** 单题视图 "同学的笔记" 列表. GET /api/v2/questions/{id}/public-notes.
 *  questionId ≤0 时 disable (mock data 阶段允许 0/负, 真 BE 422). */
export function useCommunityNotesForQuestion(
  questionId: number,
  limit = 3,
): UseQueryResult<CommunityNoteListResponse> {
  return useQuery<CommunityNoteListResponse>({
    queryKey: communityNotesKeys.forQuestion(questionId, limit),
    queryFn: () => fetchPublicNotesForQuestion(questionId, limit),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: questionId > 0,
  });
}

/** 单 note 评论列表. GET /api/v2/notebook/notes/{id}/comments. */
export function useCommunityNoteComments(
  noteId: number,
): UseQueryResult<CommunityNoteCommentList> {
  return useQuery<CommunityNoteCommentList>({
    queryKey: communityNotesKeys.comments(noteId),
    queryFn: () => fetchComments(noteId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: noteId > 0,
  });
}

// ── mutations ─────────────────────────────────────────────────────────────

/** Toggle like. POST /api/v2/notebook/notes/{id}/likes. idempotent.
 *  onSuccess invalidate community-notes (重拉 likes_count / liked_by_me). */
export function useToggleLike(): UseMutationResult<
  CommunityNoteLikeToggleResponse,
  unknown,
  number
> {
  const qc = useQueryClient();
  return useMutation<CommunityNoteLikeToggleResponse, unknown, number>({
    mutationFn: (noteId) =>
      api.post<CommunityNoteLikeToggleResponse>(
        `/notebook/notes/${noteId}/likes`,
      ),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityNotesKeys.all });
    },
  });
}

/** Toggle favorite. POST /api/v2/notebook/notes/{id}/favorites. idempotent.
 *  onSuccess invalidate community-notes (重拉 favorited_by_me). */
export function useToggleFavorite(): UseMutationResult<
  CommunityNoteFavoriteToggleResponse,
  unknown,
  number
> {
  const qc = useQueryClient();
  return useMutation<CommunityNoteFavoriteToggleResponse, unknown, number>({
    mutationFn: (noteId) =>
      api.post<CommunityNoteFavoriteToggleResponse>(
        `/notebook/notes/${noteId}/favorites`,
      ),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityNotesKeys.all });
    },
  });
}

interface CreateCommentArgs {
  readonly noteId: number;
  readonly payload: CommunityNoteCommentCreate;
}

/** Create comment (一级嵌套). POST /api/v2/notebook/notes/{id}/comments.
 *  onSuccess invalidate 该 note 的 comments + community-notes (重拉 comments_count). */
export function useCreateNoteComment(): UseMutationResult<
  CommunityNoteComment,
  unknown,
  CreateCommentArgs
> {
  const qc = useQueryClient();
  return useMutation<CommunityNoteComment, unknown, CreateCommentArgs>({
    mutationFn: ({ noteId, payload }) =>
      api.post<CommunityNoteComment, CommunityNoteCommentCreate>(
        `/notebook/notes/${noteId}/comments`,
        payload,
      ),
    retry: false,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: communityNotesKeys.comments(vars.noteId),
      });
      void qc.invalidateQueries({ queryKey: communityNotesKeys.all });
    },
  });
}
