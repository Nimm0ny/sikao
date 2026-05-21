/**
 * SIKAO Wave 8 Phase D · Home 4-block real useQuery hooks.
 *
 * 替代 Phase C 的 useHomeMocks.ts (已删). 4 hook 1:1 wrap BE endpoint:
 *   - useContinueLastSession → GET /api/v2/practice/last-session
 *   - useTodayStudyPlan      → GET /api/v2/dashboard/today（legacy block shim）
 *   - useUpcomingExams       → GET /api/v2/user-exams
 *   - useWeakModules         → GET /api/v2/practice/wrong-questions/weakness
 *
 * 类型走 components['schemas'] (api.generated.ts) — 不再自造 Mock* 类型.
 * Dashboard.tsx + 4 block component 共用此模块, signature 跟 mock 同形:
 *   { data, isLoading, isError }.
 *
 * axios baseURL = '/api/v2' (utils/request.ts), 这里 path 用 relative.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import type { StudyPlanResponse } from '@sikao/api-client/types/study-plan';
export type { StudyPlanResponse } from '@sikao/api-client/types/study-plan';

// ── BE schema types (api.generated.ts) ─────────────────────────────────────

export interface PracticeSessionSummary {
  readonly id: number;
  readonly paperTitle: string;
  readonly answeredCount: number;
  readonly total: number;
}

export interface UserExamRead {
  readonly id: number;
  readonly name: string;
  readonly examDate: string;
  readonly daysUntil: number;
  readonly notes?: string | null;
}

export interface UserExamList {
  readonly exams: readonly UserExamRead[];
}

export interface UserExamCreate {
  readonly name: string;
  readonly examDate: string;
  readonly notes?: string;
}

export interface WeakModule {
  readonly subject: '言语' | '数量' | '判断' | '资料' | '常识';
  readonly score: number;
  readonly wrongRate: number;
  readonly completionRate: number;
  readonly suggestedAction: string;
}

export interface WeakModuleListResponse {
  readonly modules: readonly WeakModule[];
}

interface DashboardTodayCompat {
  readonly date: string;
  readonly planId: number | null;
  readonly events: readonly {
    id: string;
    title: string;
    category: string;
    startAt: string;
    endAt: string;
    status: string;
    isRecurringInstance?: boolean;
  }[];
}

function mapEventTaskKind(category: string): 'practice' | 'review_wrong' | 'essay_writing' {
  if (category === 'review') return 'review_wrong';
  if (category === 'essay') return 'essay_writing';
  return 'practice';
}

function mapEventStatus(status: string): 'pending' | 'completed' | 'skipped' {
  if (status === 'done') return 'completed';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

// ── Query keys (集中管理便于 invalidate) ────────────────────────────────────

export const homeKeys = {
  all: ['home'] as const,
  lastSession: () => ['home', 'last-session'] as const,
  studyPlanToday: () => ['home', 'study-plan-today'] as const,
  // userExamsAll: invalidate 命中所有 limit variant (prefix match)
  userExamsAll: () => ['home', 'user-exams'] as const,
  userExams: (limit: number) => ['home', 'user-exams', limit] as const,
  weakModules: (limit: number) => ['home', 'weak-modules', limit] as const,
} as const;

// ── Block 1: 继续学习 ──────────────────────────────────────────────────────

/**
 * useContinueLastSession — Home block 1 数据源.
 *
 * BE: GET /api/v2/practice/last-session → PracticeSessionSummary | null.
 * staleTime 60s (session 进度变更频繁, 但不需要每次 mount 都 refetch).
 */
export function useContinueLastSession() {
  return useQuery<PracticeSessionSummary | null>({
    queryKey: homeKeys.lastSession(),
    queryFn: () => api.get<PracticeSessionSummary | null>('/practice/last-session'),
    staleTime: 60_000,
  });
}

// ── Block 2: 今日计划 ──────────────────────────────────────────────────────

/**
 * useTodayStudyPlan — Home block 2 数据源.
 *
 * BE: GET /api/v2/dashboard/today → legacy-compatible StudyPlanResponse shim.
 * staleTime 5min (今日 plan 不会高频变).
 */
export function useTodayStudyPlan() {
  return useQuery<StudyPlanResponse | null>({
    queryKey: homeKeys.studyPlanToday(),
    queryFn: () =>
      api.get<DashboardTodayCompat>('/dashboard/today').then((payload) => {
        const tasks: StudyPlanResponse['tasks'] = payload.events
          .filter((event) => !event.isRecurringInstance && Number.isFinite(Number(event.id)))
          .map((event, index) => ({
            id: Number(event.id),
            taskKind: mapEventTaskKind(event.category),
            displayOrder: index,
            status: mapEventStatus(event.status),
            completedAt: event.status === 'done' ? event.endAt : null,
            payload: {
              title: event.title,
              subtitle: `${event.startAt} - ${event.endAt}`,
            },
          }));
        return {
          id: payload.planId ?? 0,
          planDate: payload.date,
          generationStatus: 'legacy_compat',
          dailyQuota: null,
          dailyAccuracyTarget: null,
          tasks,
        } satisfies StudyPlanResponse;
      }),
    staleTime: 5 * 60_000,
  });
}

// ── Block 3: 临考冲刺 ──────────────────────────────────────────────────────

/**
 * useUpcomingExams — Home block 3 数据源.
 *
 * BE: GET /api/v2/user-exams → UserExamList. limit 默认 10 (Home ≤10 row).
 * staleTime 10min (考试目标变化频率低).
 */
export function useUpcomingExams(limit = 10) {
  return useQuery<UserExamList>({
    queryKey: homeKeys.userExams(limit),
    queryFn: () =>
      api.get<UserExamList>('/user-exams', { params: { limit } }),
    staleTime: 10 * 60_000,
  });
}

/**
 * useCreateUserExam — POST /api/v2/user-exams (Wave 8 Phase D wire).
 *
 * onSuccess invalidate userExamsAll prefix → 命中所有 limit variant 重 fetch list.
 * retry: false — mutation 失败抛给 caller view (toast / ErrorBoundary), 不 silent
 * fallback (frontend/CLAUDE.md §3.1 Fail-Fast).
 */
export function useCreateUserExam(): UseMutationResult<
  UserExamRead,
  unknown,
  UserExamCreate
> {
  const qc = useQueryClient();
  return useMutation<UserExamRead, unknown, UserExamCreate>({
    mutationFn: (payload) =>
      api.post<UserExamRead, UserExamCreate>('/user-exams', payload),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: homeKeys.userExamsAll() });
    },
  });
}

/**
 * useDeleteUserExam — DELETE /api/v2/user-exams/{exam_id} (Wave 8 Phase D wire).
 *
 * BE 204 No Content, FE 不需要 response body. onSuccess invalidate userExamsAll
 * 同上.
 */
export function useDeleteUserExam(): UseMutationResult<void, unknown, number> {
  const qc = useQueryClient();
  return useMutation<void, unknown, number>({
    mutationFn: (examId) => api.delete<void>(`/user-exams/${examId}`),
    retry: false,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: homeKeys.userExamsAll() });
    },
  });
}

// ── Block 4: 薄弱模块 ──────────────────────────────────────────────────────

/**
 * useWeakModules — Home block 4 数据源.
 *
 * BE: GET /api/v2/practice/wrong-questions/weakness?limit=N → WeakModuleListResponse.
 * Home block 默认 limit=2 (top-2 薄弱模块). staleTime 5min.
 *
 * 注意: BE 实际路径含 `/practice/` 前缀, schema 注释 (5489) "/api/v2/wrong-questions/weakness"
 * 有误差 — 真路径以 api.generated.ts L2056 "/api/v2/practice/wrong-questions/weakness" 为准.
 */
export function useWeakModules({ limit }: { readonly limit: number }) {
  return useQuery<WeakModuleListResponse>({
    queryKey: homeKeys.weakModules(limit),
    queryFn: () =>
      api.get<WeakModuleListResponse>('/practice/wrong-questions/weakness', {
        params: { limit },
      }),
    staleTime: 5 * 60_000,
  });
}
