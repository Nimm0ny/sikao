/**
 * Slice 3b · 学习计划 React Query keys + fetcher + hooks.
 *
 * D1 决策: 类型从 `@/types/study-plan` (re-export from api.generated.ts) 拿,
 * 不再手写. R1 follow-up: BE schema 改了忘 regen → tsc -b 编译时报错兜底.
 *
 * P2 #5 + #7 (plan §3.1 React Query 配置):
 * - staleTime 30min — 学习计划日级数据
 * - retry: 401 不 retry (RedirectGuard 处理), 其他错最多 retry 2 次
 * - refetchOnWindowFocus false — 日级数据
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type InfiniteData,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import type {
  PracticeSessionStartV2,
  StudyPlanHistoryListV2,
  StudyPlanResponse,
  StudyPlanStartPayload,
  StudyTaskPatchRequest,
  StudyTaskResponse,
} from '../types/study-plan';

// ── React Query keys ─────────────────────────────────────────────────────

export const studyPlanKeys = {
  all: ['study-plan'] as const,
  today: () => ['study-plan', 'today'] as const,
  history: () => ['study-plan', 'history'] as const,
  // Slice 3d (P0-4 v0.2 review): id 必须 number, URL 解析在 view 层做 parseInt
  detail: (id: number) => ['study-plan', 'detail', id] as const,
} as const;

// ── fetcher ──────────────────────────────────────────────────────────────
// retry policy (Sunday Polish 2026-05-08): inline shouldRetry 已抽到
// `@/lib/queryRetry` 共享, 收严为 "全 4xx fail-fast / 5xx retry 2 次".

export function fetchStudyPlanToday() {
  return api.get<StudyPlanResponse>('/study-plan/today', { timeout: 15_000 });
}

export function patchStudyTask(taskId: number, body: StudyTaskPatchRequest) {
  return api.patch<StudyTaskResponse, StudyTaskPatchRequest>(
    `/study-plan/tasks/${taskId}`,
    body,
  );
}

export function startStudyPlanSession(payload: StudyPlanStartPayload) {
  return api.post<PracticeSessionStartV2, StudyPlanStartPayload>(
    '/practice/study-plan/start',
    payload,
  );
}

const HISTORY_PAGE_LIMIT = 20;

export function fetchStudyPlanDetail(
  planId: number,
): Promise<StudyPlanResponse> {
  return api.get<StudyPlanResponse>(`/study-plan/${planId}`);
}

export function fetchStudyPlanHistory(
  cursor: string | undefined,
): Promise<StudyPlanHistoryListV2> {
  // cursor 是 ISO date string (e.g. '2026-04-29'), undefined = 第一页
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_LIMIT) });
  if (cursor) params.set('cursor', cursor);
  return api.get<StudyPlanHistoryListV2>(
    `/study-plan/history?${params.toString()}`,
  );
}

// ── hooks ────────────────────────────────────────────────────────────────

export function useStudyPlanToday(): UseQueryResult<StudyPlanResponse> {
  return useQuery<StudyPlanResponse>({
    queryKey: studyPlanKeys.today(),
    queryFn: fetchStudyPlanToday,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    // review P1-1: 跨日 (用户 23:59 mount → 00:01 切回来) staleTime 30min 不
    // 自动失效会显示昨天 plan. refetchOnMount: 'always' 让 Dashboard 每次
    // mount 都重 fetch, 解决跨日 stale 但不破坏同 mount 内 cache hit.
    refetchOnMount: 'always',
    retry: shouldRetry,
  });
}

interface PatchVariables {
  readonly id: number;
  readonly status: StudyTaskPatchRequest['status'];
}

export function usePatchStudyTask(): UseMutationResult<
  StudyTaskResponse,
  unknown,
  PatchVariables,
  { previous: StudyPlanResponse | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation<
    StudyTaskResponse,
    unknown,
    PatchVariables,
    { previous: StudyPlanResponse | undefined }
  >({
    mutationFn: ({ id, status }) => patchStudyTask(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: studyPlanKeys.today() });
      const previous = queryClient.getQueryData<StudyPlanResponse>(
        studyPlanKeys.today(),
      );
      // review P0-3: callback form `(old) => ...` 替代 cast,
      // TS 推断 old 是 StudyPlanResponse | undefined, 不需要绕 narrow.
      // skipped 路径只动 status 不动 completedAt (BE 语义对称).
      queryClient.setQueryData<StudyPlanResponse>(
        studyPlanKeys.today(),
        (old) => {
          if (old == null) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) => {
              if (t.id !== id) return t;
              if (status === 'completed') {
                return { ...t, status, completedAt: new Date().toISOString() };
              }
              return { ...t, status };
            }),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(studyPlanKeys.today(), ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: studyPlanKeys.today() });
    },
  });
}

export function useStartStudyPlanSession(): UseMutationResult<
  PracticeSessionStartV2,
  unknown,
  StudyPlanStartPayload
> {
  return useMutation<PracticeSessionStartV2, unknown, StudyPlanStartPayload>({
    mutationFn: startStudyPlanSession,
    retry: false,
  });
}

// ── Slice 3d: detail single query ────────────────────────────────────────

/**
 * 学习计划详情 (planId 已知). plan §3.2.
 *
 * BE GET /study-plan/{plan_id} 返完整 StudyPlanResponse (跟 /today 共享).
 * staleTime 4 小时 — 历史是不可变事实, 比 today/history 长. 401 + 404 都不
 * retry (shouldRetry 共享).
 *
 * Caller 责任 (P0-1 v0.2 review): 传 number 进来, 不要让 string 漂入.
 * URL 解析在 view 层做 `parseInt(useParams().planId, 10)` + 判 `Number.isNaN`,
 * 守门后才 enabled.
 */
export function useStudyPlanDetail(
  planId: number,
): UseQueryResult<StudyPlanResponse> {
  return useQuery<StudyPlanResponse>({
    queryKey: studyPlanKeys.detail(planId),
    queryFn: () => fetchStudyPlanDetail(planId),
    staleTime: 1000 * 60 * 60 * 4,
    gcTime: 1000 * 60 * 60 * 6,
    retry: shouldRetry,
    refetchOnWindowFocus: false,
    // P2-1 v0.2 review: 不设 refetchOnMount: 'always' (跟 today/history 不同) —
    // 历史 plan 不可变, 4 小时 staleTime 内 mount 直接 cache hit, 跨日不破.
    enabled: !Number.isNaN(planId),
  });
}

// ── Slice 3c: history infinite query ─────────────────────────────────────

/**
 * 学习计划历史 cursor 分页 hook. plan §3.1 §3.2 落地.
 *
 * BE GET /study-plan/history?cursor=<ISO-date>&limit=20 返
 * `{items, nextCursor}`. nextCursor=null 表示已到底; getNextPageParam 返
 * undefined 让 useInfiniteQuery 把 hasNextPage 置 false.
 *
 * staleTime 30 分钟 (跟 today 一致 — 历史变化更慢, 但用统一 SLA 简化).
 * 401 不 retry (RedirectGuard 接管, 跟 today 一致).
 */
export function useStudyPlanHistory(): UseInfiniteQueryResult<
  InfiniteData<StudyPlanHistoryListV2, string | undefined>,
  unknown
> {
  return useInfiniteQuery<
    StudyPlanHistoryListV2,
    unknown,
    InfiniteData<StudyPlanHistoryListV2, string | undefined>,
    readonly ['study-plan', 'history'],
    string | undefined
  >({
    queryKey: studyPlanKeys.history(),
    queryFn: ({ pageParam }) => fetchStudyPlanHistory(pageParam),
    initialPageParam: undefined,
    // nextCursor 是 BE 返的 ISO date string (CamelModel auto-alias snake_case).
    // null = 已到底, useInfiniteQuery 接到 undefined 把 hasNextPage 置 false.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    // P1-1 (commit 3 review): cross-day stale 防御 — 23:59 勾完今日 task →
    // 00:01 进 history view, BE 已把昨天 plan 计入历史, FE staleTime 30min
    // 没 fresh 显旧数据. refetchOnMount: 'always' 强制每次 mount 重拉 (跟
    // useStudyPlanToday 同策略).
    refetchOnMount: 'always',
    retry: shouldRetry,
  });
}
