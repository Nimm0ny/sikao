/**
 * PR13 P5 FE · 申论草稿 react-query mutation + autosave hook.
 *
 * Endpoints (BE shipped d2f1b7e, plan §8 deviation 已字符级对齐):
 *   GET  /api/v2/essay/drafts/{question_id}  → 当前用户某题最新草稿; 404 if 无
 *   POST /api/v2/essay/drafts                → upsert (user_id, question_id)
 *
 * 数据流模式 mirror useCommunityNotes.ts (Wave 10 Phase D pattern):
 *   - useQuery 走 shouldRetry (全 4xx fail-fast, 5xx retry 2 次)
 *   - mutation 不 retry, 失败抛给 caller view (saveStatus = 'unsaved')
 *   - mutation onSuccess invalidate 命中的 essay-drafts query key
 *
 * autosave 设计 (plan §8):
 *   - lodash-es/debounce 2s, useMemo 缓存稳定引用
 *   - useEffect cleanup → debouncedSave.cancel() 避免 unmount 后还触发
 *   - status 状态机: idle → saving → saved / unsaved → saving → ...
 *
 * Fail-Fast (frontend/CLAUDE.md §3.1): error 不 silent fallback. mutation
 * isError 由 saveStatus = 'unsaved' 暴露给 view; query 404 给 caller view
 * 判断 (用户没草稿是常态, 不算错误). caller 走 query.isError + error.status
 * 区分 "无草稿" vs "真错误".
 */
import { useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { debounce, type DebouncedFunc } from 'lodash-es';
import { api } from '@sikao/api-client/request';
import { shouldRetry } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import type { EssayDraft, EssayDraftSubmission } from '@sikao/api-client/types/api';

// ── re-export schema 类型 ─────────────────────────────────────────────────

export type { EssayDraft, EssayDraftSubmission } from '@sikao/api-client/types/api';

/** TopBar SaveStatus pill 状态机. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

// ── React Query keys ─────────────────────────────────────────────────────

export const essayDraftKeys = {
  all: ['essay-drafts'] as const,
  byQuestion: (questionId: number) =>
    ['essay-drafts', 'by-question', questionId] as const,
} as const;

// ── fetchers ─────────────────────────────────────────────────────────────

function fetchDraft(questionId: number): Promise<EssayDraft> {
  return api.get<EssayDraft>(`/essay/drafts/${questionId}`);
}

function postDraft(payload: EssayDraftSubmission): Promise<EssayDraft> {
  return api.post<EssayDraft, EssayDraftSubmission>('/essay/drafts', payload);
}

// ── queries ──────────────────────────────────────────────────────────────

/**
 * 单题草稿查询. GET /api/v2/essay/drafts/{question_id}.
 *
 * questionId ≤0 时 disable (mock data 阶段允许 0/负, 真 BE 422).
 *
 * 404 处理: 用户没草稿是常态, 走 caller view 判断 isError + error 详情;
 * react-query 直接 reject 不 silent. shouldRetry 已 4xx fail-fast, 404 立即
 * 落到 isError 不浪费用户等待. caller 通过 query.isError + error 判 status
 * 区分 "新题没草稿 (404)" vs "真错误 (5xx)".
 */
export function useEssayDraftQuery(
  questionId: number,
): UseQueryResult<EssayDraft> {
  return useQuery<EssayDraft>({
    queryKey: essayDraftKeys.byQuestion(questionId),
    queryFn: () => fetchDraft(questionId),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: questionId > 0,
  });
}

// ── mutations ────────────────────────────────────────────────────────────

/**
 * 草稿 upsert mutation. POST /api/v2/essay/drafts.
 *
 * onSuccess invalidate 命中题目的 query key, 让 hidden tab / 多 view 拿
 * 最新 updated_at. 不 retry — autosave 失败由 caller 显示 'unsaved' 状态,
 * 用户下次输入 trigger 新一轮 debounce 自动重试.
 */
export function useSaveEssayDraft(): UseMutationResult<
  EssayDraft,
  unknown,
  EssayDraftSubmission
> {
  const qc = useQueryClient();
  return useMutation<EssayDraft, unknown, EssayDraftSubmission>({
    mutationFn: (payload) => postDraft(payload),
    retry: false,
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: essayDraftKeys.byQuestion(vars.questionId),
      });
    },
  });
}

// ── autosave hook ────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 2000;

export interface UseEssayDraftAutosaveOptions {
  readonly questionId: number;
  readonly typedDraft: string;
  readonly handwrittenDraftMetadata?: Record<string, unknown> | null;
  readonly debounceMs?: number;
}

export interface UseEssayDraftAutosaveResult {
  readonly saveStatus: SaveStatus;
  /** 最近一次成功保存的 unix ms. null = 从未成功保存. */
  readonly lastSavedAt: number | null;
}

/**
 * autosave hook — typedDraft 变化触发 debounce 2s POST 到 BE.
 *
 * 状态机 (plan §8):
 *   - mutation.isPending      → 'saving'
 *   - mutation.isError        → 'unsaved' (caller 决定 toast / 不 toast)
 *   - lastSavedAt !== null    → 'saved'
 *   - 否则                     → 'idle'
 *
 * questionId ≤0 时 hook 不真 call BE (mock data 阶段 mockSession string id
 * 通过 caller 的 map 函数转 -1 → enabled false → mutation 不触发). 等真 BE
 * session 接入后传 real int id → enabled 自动开.
 *
 * unmount cleanup: debouncedSave.cancel() 避免 trailing call 在组件 unmount
 * 后还触发 (React Query mutation 即使 retry=false, 也会 throw 到 console).
 */
export function useEssayDraftAutosave(
  options: UseEssayDraftAutosaveOptions,
): UseEssayDraftAutosaveResult {
  const {
    questionId,
    typedDraft,
    handwrittenDraftMetadata = null,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const mutation = useSaveEssayDraft();
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // React 19 lint (react-hooks/refs / react-hooks/purity) 禁 render 期读 ref +
  // useMemo factory 内 capture ref. 用 useRef 持 debouncer instance, 在 effect
  // 里 lazy create 一次 (mount-only) — 跟 NoteEditor.tsx 模式不同 (那是 React 18
  // 的 useMemo) 但功能等价. mutation.mutate 引用稳定 (React Query 保证), effect
  // 闭包 capture 一次即可, 不进 deps (类似 NoteEditor 的 // eslint-disable-next-line).
  const debouncedRef = useRef<DebouncedFunc<(payload: EssayDraftSubmission) => void> | null>(null);
  // 同步最新 mutate, effect 内读 — 避开 render-期 ref access.
  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  // Lazy init debouncer in mount effect (跟 useEssaySessionElapsed startMs 同
  // pattern). 单 mount cycle 内只建一次, unmount cancel + clear.
  useEffect(() => {
    const fn = debounce((payload: EssayDraftSubmission) => {
      mutateRef.current(payload, {
        onSuccess: () => {
          setLastSavedAt(Date.now());
        },
        onError: (err) => {
          logger.warn('essay-draft.autosave.failed', {
            questionId: payload.questionId,
            err: String(err),
          });
        },
      });
    }, debounceMs);
    debouncedRef.current = fn;
    return () => {
      fn.cancel();
      debouncedRef.current = null;
    };
  }, [debounceMs]);

  // typedDraft / handwrittenDraftMetadata / questionId 变化 → 触发 debounced save.
  // enabled guard: questionId ≤0 不 call BE (mock data 阶段 placeholder).
  // debouncedRef.current 可能 null (mount effect 先于此 effect 执行 — React
  // effect 顺序保证). 兜底 null check 让 SSR/race 不炸.
  useEffect(() => {
    if (questionId <= 0) return;
    const fn = debouncedRef.current;
    if (fn === null) return;
    fn({
      questionId,
      typedDraft,
      handwrittenDraftMetadata,
    });
  }, [questionId, typedDraft, handwrittenDraftMetadata]);

  // 状态机派生.
  const saveStatus: SaveStatus = mutation.isPending
    ? 'saving'
    : mutation.isError
      ? 'unsaved'
      : lastSavedAt !== null
        ? 'saved'
        : 'idle';

  return {
    saveStatus,
    lastSavedAt,
  };
}
