/**
 * SIKAO Wave 5 · 错题本学习热图 hook.
 *
 * 配 BE GET /api/v2/practice/wrong-questions/heatmap?days=N (Wave 5 backlog,
 * lhr 2026-05-12 批 --data-* token + endpoint).
 *
 * 5 行 (言语/数量/判推/资分/常识) × N 列 (≤180 天) 错题强度. 行内 peak_idx
 * 由 BE 计算 (max count cell idx; 全 0 时 None). cells[-1] = 今天 (BE
 * Asia/Shanghai 本地日).
 *
 * Fail-Fast (CLAUDE.md §4): 5xx retry 2 次 / 4xx 不 retry; 不 `?? []` 兜底,
 * error 交 QueryBoundary 显式错误态.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@sikao/api-client/request';
import { shouldRetry } from '@sikao/shared-utils';
import type { components } from '@sikao/api-client/types/api.generated';

export type WrongBookHeatmapResponse =
  components['schemas']['WrongBookHeatmapResponse'];
export type WrongBookHeatmapRow =
  components['schemas']['WrongBookHeatmapRow'];
export type WrongBookHeatmapCell =
  components['schemas']['WrongBookHeatmapCell'];

export type HeatmapDays = 7 | 30 | 90 | 180;

export const wrongBookHeatmapKeys = {
  heatmap: (days: HeatmapDays) =>
    ['wrong-book', 'heatmap', days] as const,
} as const;

export function fetchWrongBookHeatmap(
  days: HeatmapDays,
): Promise<WrongBookHeatmapResponse> {
  return api.get<WrongBookHeatmapResponse>(
    '/practice/wrong-questions/heatmap',
    { params: { days } },
  );
}

export function useWrongBookHeatmap(
  days: HeatmapDays = 30,
): UseQueryResult<WrongBookHeatmapResponse> {
  return useQuery<WrongBookHeatmapResponse>({
    queryKey: wrongBookHeatmapKeys.heatmap(days),
    queryFn: () => fetchWrongBookHeatmap(days),
    // heatmap 聚合 30+ 天数据, 不需要实时. 5 min stale + 30 min gc 跟
    // wrongBookV2Keys.summary 同节奏.
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}
