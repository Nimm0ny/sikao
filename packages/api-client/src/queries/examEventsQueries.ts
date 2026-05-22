/**
 * SIKAO Wave 1 P2 backlog · exam-events React Query + 国考倒计时 hook.
 *
 * BE 契约: GET /api/v2/exam-events 返 ExamEventListResponse {items[]}, 按
 * examDate asc 排序; visible=False 由 admin 隐藏的不进 list. 不支持 category
 * query param — FE 全集过滤 (数据量小 10-50 events).
 *
 * 数据流: BE 全集 → filter category==='national' → 升序 first → 计算 daysUntil.
 *
 * Fail-Fast (CLAUDE.md §4 + frontend §3.1):
 *   - 4xx 不 retry (共享 shouldRetry)
 *   - error → toast.error 通知 user + 兜底 DEFAULT_EXAM_DATE_ISO (graceful 非
 *     silent — 用户知情). loading 同样落兜底, 避免 flash.
 *   - 没 national event (空 items 或全 filter 掉) → 退兜底文案 (BE 偶发空集
 *     是可能业务场景, 不抛错).
 *
 * staleTime 1h — events 不频繁变 (admin 一年改几次).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { logger } from '@sikao/shared-utils';
import {
  DEFAULT_EXAM_DATE_ISO,
  DEFAULT_EXAM_LABEL,
  daysUntilExam,
} from '@sikao/domain/study-record/exam-countdown';
import type { ExamEventListResponse, ExamEventOutV2 } from '../types/api';

export type { ExamEventListResponse, ExamEventOutV2 } from '../types/api';
export type ExamCategory = ExamEventOutV2['category'];

export const examEventKeys = {
  all: ['exam-events'] as const,
  list: () => ['exam-events', 'list'] as const,
} as const;

export function fetchExamEvents(): Promise<ExamEventListResponse> {
  return api.get<ExamEventListResponse>('/exam-events');
}

export function useExamEvents(): UseQueryResult<ExamEventListResponse> {
  return useQuery<ExamEventListResponse>({
    queryKey: examEventKeys.list(),
    queryFn: fetchExamEvents,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export interface NationalExamCountdown {
  readonly examDateISO: string;
  readonly examLabel: string;
  readonly daysUntil: number;
  readonly isLoading: boolean;
  /** True 当 fallback (loading / error / 空集) — caller 可选择性渲 hint. */
  readonly isFallback: boolean;
}

/**
 * 国考倒计时 hook. BE 真值 + hardcode 兜底.
 *
 * 兜底语义: loading / error / 空集 全退 DEFAULT_EXAM_*. error 时同时 toast.error
 * 通知用户 (graceful, 非 silent — frontend §3.1 fail-fast 软降级是 view 层兜底,
 * 不吞错). 同 query 实例多次重渲只 toast 一次 (useRef 守门).
 */
export function useNationalExamCountdown(): NationalExamCountdown {
  const query = useExamEvents();
  const toastedRef = useRef(false);

  useEffect(() => {
    if (query.isError && !toastedRef.current) {
      toastedRef.current = true;
      logger.warn('exam-events.fetch.failed.fallback', {
        err: String(query.error),
      });
      toast.error('考期数据加载失败', '已显示默认国考日期，可稍后重试。');
    }
    if (!query.isError) {
      // reset 让下次 error 仍提示 (e.g. refetch 后再失败).
      toastedRef.current = false;
    }
  }, [query.isError, query.error]);

  return useMemo<NationalExamCountdown>(() => {
    const fallback: NationalExamCountdown = {
      examDateISO: DEFAULT_EXAM_DATE_ISO,
      examLabel: DEFAULT_EXAM_LABEL,
      daysUntil: daysUntilExam(DEFAULT_EXAM_DATE_ISO),
      isLoading: query.isLoading,
      isFallback: true,
    };
    if (query.isLoading || query.isError || query.data == null) {
      return fallback;
    }
    const national = query.data.items
      .filter((e) => e.category === 'national')
      .sort((a, b) => a.examDate.localeCompare(b.examDate));
    if (national.length === 0) return fallback;
    const first = national[0];
    return {
      examDateISO: first.examDate,
      examLabel: first.name,
      daysUntil: daysUntilExam(first.examDate),
      isLoading: false,
      isFallback: false,
    };
  }, [query.isLoading, query.isError, query.data]);
}
