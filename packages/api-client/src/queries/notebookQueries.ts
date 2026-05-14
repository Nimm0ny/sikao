/**
 * SIKAO Wave 4 Phase 2D · Notebook React Query hooks.
 *
 * 接 ac87f2f BE (`/api/v2/notebook/*`) 9 endpoint. types 走 api.generated.ts
 * SSOT (`NoteOutV2 / NoteListOutV2 / ...`).
 *
 * 数据流模式 (跟 studyPlanQueries / examEventsQueries 一致):
 *   - useQuery 走 shouldRetry (全 4xx fail-fast, 5xx retry 2 次)
 *   - mutation 不 retry, 失败抛给 caller 处理 toast
 *   - list 用 useInfiniteQuery cursor 分页 (BE nextCursor 是 last id)
 *   - mutation invalidate 命中的 queryKey
 *
 * Fail-Fast (frontend §3.1): error 不 silent fallback. mutation onSuccess
 * invalidate, onError 由 caller view 层 toast.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import type { components } from '@sikao/api-client/types/api.generated';

// ── re-export schema 类型 ──────────────────────────────────────────────────

export type NoteOutV2 = components['schemas']['NoteOutV2'];
export type NoteCreateV2 = components['schemas']['NoteCreateV2'];
export type NoteUpdateV2 = components['schemas']['NoteUpdateV2'];
export type NoteListOutV2 = components['schemas']['NoteListOutV2'];
export type NoteReviewOutV2 = components['schemas']['NoteReviewOutV2'];
export type NoteReviewListOutV2 = components['schemas']['NoteReviewListOutV2'];
export type NoteReviewSubmitV2 = components['schemas']['NoteReviewSubmitV2'];
export type NoteStatsV2 = components['schemas']['NoteStatsV2'];
export type NoteAttachedToV2 = components['schemas']['NoteAttachedToV2'];
export type NoteType = NoteOutV2['type'];
export type NoteSourceKind = NoteOutV2['sourceKind'];
export type NoteSourceDomain = NoteOutV2['sourceDomain'];

// ── React Query keys ──────────────────────────────────────────────────────

export const notebookKeys = {
  all: ['notebook'] as const,
  notes: () => ['notebook', 'notes'] as const,
  notesList: (filters: NotesListFilters) =>
    ['notebook', 'notes', 'list', filters] as const,
  note: (id: number) => ['notebook', 'notes', 'detail', id] as const,
  reviews: (noteId: number) =>
    ['notebook', 'notes', noteId, 'reviews'] as const,
  due: () => ['notebook', 'reviews', 'due'] as const,
  stats: () => ['notebook', 'stats'] as const,
} as const;

// ── filter shape (list query) ─────────────────────────────────────────────

export interface NotesListFilters {
  readonly type?: NoteType;
  readonly sourceDomain?: NoteSourceDomain;
  readonly tag?: string;
}

const LIST_PAGE_LIMIT = 20;

// ── fetchers ──────────────────────────────────────────────────────────────

function fetchNotes(
  filters: NotesListFilters,
  cursor: number | undefined,
): Promise<NoteListOutV2> {
  const params = new URLSearchParams({ limit: String(LIST_PAGE_LIMIT) });
  if (filters.type !== undefined) params.set('type', filters.type);
  if (filters.sourceDomain !== undefined) {
    params.set('sourceDomain', filters.sourceDomain);
  }
  if (filters.tag !== undefined) params.set('tag', filters.tag);
  if (cursor !== undefined) params.set('cursor', String(cursor));
  return api.get<NoteListOutV2>(`/notebook/notes?${params.toString()}`);
}

function fetchNote(noteId: number): Promise<NoteOutV2> {
  return api.get<NoteOutV2>(`/notebook/notes/${noteId}`);
}

function fetchDueNotes(): Promise<NoteListOutV2> {
  return api.get<NoteListOutV2>('/notebook/reviews/due?limit=5');
}

function fetchStats(): Promise<NoteStatsV2> {
  return api.get<NoteStatsV2>('/notebook/stats');
}

function fetchReviews(noteId: number): Promise<NoteReviewListOutV2> {
  return api.get<NoteReviewListOutV2>(`/notebook/notes/${noteId}/reviews`);
}

// ── queries ───────────────────────────────────────────────────────────────

/**
 * Infinite list — cursor 是 last note id. nextCursor=null = 已到底.
 * staleTime 5min — 笔记是用户驱动的写入, mutation 后主动 invalidate 比 stale 更准.
 */
export function useNotes(
  filters: NotesListFilters,
): UseInfiniteQueryResult<
  InfiniteData<NoteListOutV2, number | undefined>,
  unknown
> {
  return useInfiniteQuery<
    NoteListOutV2,
    unknown,
    InfiniteData<NoteListOutV2, number | undefined>,
    readonly ['notebook', 'notes', 'list', NotesListFilters],
    number | undefined
  >({
    queryKey: notebookKeys.notesList(filters),
    queryFn: ({ pageParam }) => fetchNotes(filters, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useNote(
  noteId: number,
): UseQueryResult<NoteOutV2> {
  return useQuery<NoteOutV2>({
    queryKey: notebookKeys.note(noteId),
    queryFn: () => fetchNote(noteId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: !Number.isNaN(noteId) && noteId > 0,
  });
}

export function useDueNotes(): UseQueryResult<NoteListOutV2> {
  return useQuery<NoteListOutV2>({
    queryKey: notebookKeys.due(),
    queryFn: fetchDueNotes,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useNotebookStats(): UseQueryResult<NoteStatsV2> {
  return useQuery<NoteStatsV2>({
    queryKey: notebookKeys.stats(),
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useNoteReviews(
  noteId: number,
): UseQueryResult<NoteReviewListOutV2> {
  return useQuery<NoteReviewListOutV2>({
    queryKey: notebookKeys.reviews(noteId),
    queryFn: () => fetchReviews(noteId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: !Number.isNaN(noteId) && noteId > 0,
  });
}

// ── mutations ─────────────────────────────────────────────────────────────

export function useCreateNote(): UseMutationResult<
  NoteOutV2,
  unknown,
  NoteCreateV2
> {
  const qc = useQueryClient();
  return useMutation<NoteOutV2, unknown, NoteCreateV2>({
    mutationFn: (payload) =>
      api.post<NoteOutV2, NoteCreateV2>('/notebook/notes', payload),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notebookKeys.notes() });
      void qc.invalidateQueries({ queryKey: notebookKeys.stats() });
      void qc.invalidateQueries({ queryKey: notebookKeys.due() });
    },
  });
}

interface UpdateNoteArgs {
  readonly noteId: number;
  readonly payload: NoteUpdateV2;
}

export function useUpdateNote(): UseMutationResult<
  NoteOutV2,
  unknown,
  UpdateNoteArgs
> {
  const qc = useQueryClient();
  return useMutation<NoteOutV2, unknown, UpdateNoteArgs>({
    mutationFn: ({ noteId, payload }) =>
      api.put<NoteOutV2, NoteUpdateV2>(
        `/notebook/notes/${noteId}`,
        payload,
      ),
    retry: false,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: notebookKeys.notes() });
      void qc.invalidateQueries({ queryKey: notebookKeys.note(vars.noteId) });
      void qc.invalidateQueries({ queryKey: notebookKeys.stats() });
    },
  });
}

export function useDeleteNote(): UseMutationResult<void, unknown, number> {
  const qc = useQueryClient();
  return useMutation<void, unknown, number>({
    mutationFn: (noteId) => api.delete<void>(`/notebook/notes/${noteId}`),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notebookKeys.notes() });
      void qc.invalidateQueries({ queryKey: notebookKeys.stats() });
      void qc.invalidateQueries({ queryKey: notebookKeys.due() });
    },
  });
}

interface SubmitReviewArgs {
  readonly noteId: number;
  readonly recallQuality: number;
}

export function useSubmitReview(): UseMutationResult<
  NoteOutV2,
  unknown,
  SubmitReviewArgs
> {
  const qc = useQueryClient();
  return useMutation<NoteOutV2, unknown, SubmitReviewArgs>({
    mutationFn: ({ noteId, recallQuality }) =>
      api.post<NoteOutV2, NoteReviewSubmitV2>(
        `/notebook/notes/${noteId}/reviews`,
        { recallQuality },
      ),
    retry: false,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: notebookKeys.due() });
      void qc.invalidateQueries({ queryKey: notebookKeys.notes() });
      void qc.invalidateQueries({ queryKey: notebookKeys.note(vars.noteId) });
      void qc.invalidateQueries({
        queryKey: notebookKeys.reviews(vars.noteId),
      });
      void qc.invalidateQueries({ queryKey: notebookKeys.stats() });
    },
  });
}
