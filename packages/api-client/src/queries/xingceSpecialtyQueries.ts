/**
 * SIKAO Wave 5A · xingce-specialty FE React Query hooks.
 *
 * 接 Xa-BE 7a06b94 4 endpoint (mirror essay_specialty_v2):
 *   GET /api/v2/papers/xingce/specialty/summary    → totals + resume hero
 *   GET /api/v2/papers/xingce/specialty/categories → 5 大类 + 子类三态
 *   GET /api/v2/papers/xingce/list/extended        → paginated 扩字段 list
 *   GET /api/v2/papers/xingce/filters              → chip 候选 (regions/years/paperTypes)
 *
 * 类型从 `@/types/api.generated.ts` (openapi-typescript regen) 拿,
 * 不手写 — BE schema 改了忘 regen → tsc 报错兜底 (跟 essaySpecialtyQueries / studyPlanQueries 同模式).
 *
 * staleTime 选择 (跟 essaySpecialtyQueries.ts 同):
 *   - summary / categories: 5min — per-user 数据, 切到 view 都吃到最新 progress
 *   - filters: 60min — 元数据, 改动罕见
 *   - list/extended: 2min — 用户切 page / filter 高频, 短 stale + cache key 隔离
 */
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import type { components } from '@sikao/api-client/types/api.generated';

export type XingceSpecialtySummaryV2 =
  components['schemas']['XingceSpecialtySummaryV2'];
export type XingceSpecialtyCategoriesResponseV2 =
  components['schemas']['XingceSpecialtyCategoriesResponseV2'];
export type XingceSpecialtyCategoryV2 =
  components['schemas']['XingceSpecialtyCategoryV2'];
export type XingceSpecialtySubtypeRowV2 =
  components['schemas']['XingceSpecialtySubtypeRowV2'];
export type XingceSpecialtyTotalsV2 =
  components['schemas']['XingceSpecialtyTotalsV2'];
export type XingceSpecialtyResumeV2 =
  components['schemas']['XingceSpecialtyResumeV2'];
export type XingcePapersListExtendedResponseV2 =
  components['schemas']['XingcePapersListExtendedResponseV2'];
export type XingcePaperListItemV2Extended =
  components['schemas']['XingcePaperListItemV2Extended'];
export type XingceLastAttemptV2 =
  components['schemas']['XingceLastAttemptV2'];
export type XingcePapersFiltersResponseV2 =
  components['schemas']['XingcePapersFiltersResponseV2'];

export type XingcePapersSort = 'default' | 'year' | 'recent';

export interface XingcePapersExtendedFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly region?: string;
  readonly year?: number;
  readonly paperType?: string;
  readonly sort: XingcePapersSort;
}

export const xingceSpecialtyQueryKeys = {
  all: ['xingce-specialty-v2'] as const,
  summary: () => ['xingce-specialty-v2', 'summary'] as const,
  categories: () => ['xingce-specialty-v2', 'categories'] as const,
  filters: () => ['xingce-specialty-v2', 'filters'] as const,
  papersExtended: (filters: XingcePapersExtendedFilters) =>
    ['xingce-specialty-v2', 'papers', 'extended', filters] as const,
} as const;

// ── fetcher ──────────────────────────────────────────────────────────────

export function fetchXingceSpecialtySummary(): Promise<XingceSpecialtySummaryV2> {
  return api.get<XingceSpecialtySummaryV2>('/papers/xingce/specialty/summary');
}

export function fetchXingceSpecialtyCategories(): Promise<XingceSpecialtyCategoriesResponseV2> {
  return api.get<XingceSpecialtyCategoriesResponseV2>(
    '/papers/xingce/specialty/categories',
  );
}

export function fetchXingcePapersFilters(): Promise<XingcePapersFiltersResponseV2> {
  return api.get<XingcePapersFiltersResponseV2>('/papers/xingce/filters');
}

// extended list 走 axios params (不手拼 query string, 缺字段不发).
// `paperType` 后端 alias='paperType' camelCase, 直接传不用 snake_case.
export function fetchXingcePapersListExtended(
  filters: XingcePapersExtendedFilters,
): Promise<XingcePapersListExtendedResponseV2> {
  const params: Record<string, string | number> = {
    page: filters.page,
    pageSize: filters.pageSize,
    sort: filters.sort,
  };
  if (filters.region !== undefined && filters.region !== '') {
    params.region = filters.region;
  }
  if (filters.year !== undefined) {
    params.year = filters.year;
  }
  if (filters.paperType !== undefined && filters.paperType !== '') {
    params.paperType = filters.paperType;
  }
  return api.get<XingcePapersListExtendedResponseV2>(
    '/papers/xingce/list/extended',
    { params },
  );
}

// ── hooks ────────────────────────────────────────────────────────────────

export function useXingceSpecialtySummary(): UseQueryResult<XingceSpecialtySummaryV2> {
  return useQuery<XingceSpecialtySummaryV2>({
    queryKey: xingceSpecialtyQueryKeys.summary(),
    queryFn: fetchXingceSpecialtySummary,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useXingceSpecialtyCategories(): UseQueryResult<XingceSpecialtyCategoriesResponseV2> {
  return useQuery<XingceSpecialtyCategoriesResponseV2>({
    queryKey: xingceSpecialtyQueryKeys.categories(),
    queryFn: fetchXingceSpecialtyCategories,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useXingcePapersFilters(): UseQueryResult<XingcePapersFiltersResponseV2> {
  return useQuery<XingcePapersFiltersResponseV2>({
    queryKey: xingceSpecialtyQueryKeys.filters(),
    queryFn: fetchXingcePapersFilters,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useXingcePapersListExtended(
  filters: XingcePapersExtendedFilters,
): UseQueryResult<XingcePapersListExtendedResponseV2> {
  return useQuery<XingcePapersListExtendedResponseV2>({
    queryKey: xingceSpecialtyQueryKeys.papersExtended(filters),
    queryFn: () => fetchXingcePapersListExtended(filters),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}
