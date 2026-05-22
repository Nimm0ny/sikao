/**
 * SIKAO Wave 4 Phase 2C · essay-specialty FE React Query hooks.
 *
 * 接 Y2-BE d14b0ab 4 endpoint:
 *   GET /api/v2/papers/essay/specialty/summary    → totals + resume hero
 *   GET /api/v2/papers/essay/specialty/categories → 5 大类 + 子类三态
 *   GET /api/v2/papers/essay/list/extended        → paginated 扩字段 list
 *   GET /api/v2/papers/essay/filters              → chip 候选 (regions/years/paperTypes)
 *
 * 类型从 `@/types/api.generated.ts` (openapi-typescript regen) 拿,
 * 不手写 — BE schema 改了忘 regen → tsc 报错兜底 (跟 studyPlanQueries 同模式).
 *
 * staleTime 选择 (跟 studyPlanQueries.ts 风格对齐):
 *   - summary / categories: 5min — per-user 数据, 切到 view 都吃到最新 progress
 *   - filters: 60min — 元数据, 改动罕见
 *   - list/extended: 2min — 用户切 page / filter 高频, 短 stale + cache key 隔离
 */
// NOTE(2026-05-22): this legacy query module now reads types from ../types/api
// adjunct contracts. The generated OpenAPI file remains the canonical backend
// SSOT, but these specific DTO names are not sourced from components.schemas.
import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../request';
import { shouldRetry } from '@sikao/shared-utils';
import type {
  EssayPapersFiltersResponseV2,
  EssayPapersListExtendedResponseV2,
  EssaySpecialtyCategoriesResponseV2,
  EssaySpecialtySummaryV2,
} from '../types/api';

export type {
  EssayLastAttemptV2,
  EssayPaperListItemV2Extended,
  EssayPapersFiltersResponseV2,
  EssayPapersListExtendedResponseV2,
  EssaySpecialtyCategoriesResponseV2,
  EssaySpecialtySummaryV2,
  SpecialtyCategoryV2,
  SpecialtyResumeV2,
  SpecialtySubtypeRowV2,
  SpecialtyTotalsV2,
} from '../types/api';

export type EssayPapersSort = 'default' | 'year' | 'recent';

export interface EssayPapersExtendedFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly region?: string;
  readonly year?: number;
  readonly paperType?: string;
  readonly sort: EssayPapersSort;
}

export const essaySpecialtyQueryKeys = {
  all: ['essay-specialty-v2'] as const,
  summary: () => ['essay-specialty-v2', 'summary'] as const,
  categories: () => ['essay-specialty-v2', 'categories'] as const,
  filters: () => ['essay-specialty-v2', 'filters'] as const,
  papersExtended: (filters: EssayPapersExtendedFilters) =>
    ['essay-specialty-v2', 'papers', 'extended', filters] as const,
} as const;

// ── fetcher ──────────────────────────────────────────────────────────────

export function fetchEssaySpecialtySummary(): Promise<EssaySpecialtySummaryV2> {
  return api.get<EssaySpecialtySummaryV2>('/papers/essay/specialty/summary');
}

export function fetchEssaySpecialtyCategories(): Promise<EssaySpecialtyCategoriesResponseV2> {
  return api.get<EssaySpecialtyCategoriesResponseV2>(
    '/papers/essay/specialty/categories',
  );
}

export function fetchEssayPapersFilters(): Promise<EssayPapersFiltersResponseV2> {
  return api.get<EssayPapersFiltersResponseV2>('/papers/essay/filters');
}

// extended list 走 axios params (不手拼 query string, 缺字段不发).
// `paperType` 后端 alias='paperType' camelCase, 直接传不用 snake_case.
export function fetchEssayPapersListExtended(
  filters: EssayPapersExtendedFilters,
): Promise<EssayPapersListExtendedResponseV2> {
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
  return api.get<EssayPapersListExtendedResponseV2>(
    '/papers/essay/list/extended',
    { params },
  );
}

// ── hooks ────────────────────────────────────────────────────────────────

export function useEssaySpecialtySummary(): UseQueryResult<EssaySpecialtySummaryV2> {
  return useQuery<EssaySpecialtySummaryV2>({
    queryKey: essaySpecialtyQueryKeys.summary(),
    queryFn: fetchEssaySpecialtySummary,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useEssaySpecialtyCategories(): UseQueryResult<EssaySpecialtyCategoriesResponseV2> {
  return useQuery<EssaySpecialtyCategoriesResponseV2>({
    queryKey: essaySpecialtyQueryKeys.categories(),
    queryFn: fetchEssaySpecialtyCategories,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useEssayPapersFilters(): UseQueryResult<EssayPapersFiltersResponseV2> {
  return useQuery<EssayPapersFiltersResponseV2>({
    queryKey: essaySpecialtyQueryKeys.filters(),
    queryFn: fetchEssayPapersFilters,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useEssayPapersListExtended(
  filters: EssayPapersExtendedFilters,
): UseQueryResult<EssayPapersListExtendedResponseV2> {
  return useQuery<EssayPapersListExtendedResponseV2>({
    queryKey: essaySpecialtyQueryKeys.papersExtended(filters),
    queryFn: () => fetchEssayPapersListExtended(filters),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}
