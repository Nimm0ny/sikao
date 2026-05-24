import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import type {
  EssayCategoriesQuery,
  EssayPapersQuery,
  ListEssayCategoriesResponseV2,
  ListEssayPapersResponseV2,
  ListXingceCategoriesResponseV2,
  ListXingcePapersResponseV2,
  PracticeCenterResponseV2,
  XingceCategoriesQuery,
  XingcePapersQuery,
} from '../types/practice';

export const practiceContentKeys = {
  all: ['practice-content-v2'] as const,
  center: () => ['practice-content-v2', 'center'] as const,
  xingceCategories: (filters: XingceCategoriesQuery = {}) =>
    ['practice-content-v2', 'xingce-categories', filters] as const,
  xingcePapers: (filters: XingcePapersQuery = {}) =>
    ['practice-content-v2', 'xingce-papers', filters] as const,
  essayCategories: (filters: EssayCategoriesQuery = {}) =>
    ['practice-content-v2', 'essay-categories', filters] as const,
  essayPapers: (filters: EssayPapersQuery = {}) =>
    ['practice-content-v2', 'essay-papers', filters] as const,
} as const;

export function fetchPracticeCenter(): Promise<PracticeCenterResponseV2> {
  return api.get<PracticeCenterResponseV2>('/practice/center');
}

export function fetchXingceCategories(
  filters: XingceCategoriesQuery = {},
): Promise<ListXingceCategoriesResponseV2> {
  return api.get<ListXingceCategoriesResponseV2>('/practice/xingce/categories', {
    params: filters,
  });
}

export function fetchXingcePapers(
  filters: XingcePapersQuery = {},
): Promise<ListXingcePapersResponseV2> {
  return api.get<ListXingcePapersResponseV2>('/practice/xingce/papers', {
    params: filters,
  });
}

export function fetchEssayCategories(
  filters: EssayCategoriesQuery = {},
): Promise<ListEssayCategoriesResponseV2> {
  return api.get<ListEssayCategoriesResponseV2>('/practice/essay/categories', {
    params: filters,
  });
}

export function fetchEssayPapers(
  filters: EssayPapersQuery = {},
): Promise<ListEssayPapersResponseV2> {
  return api.get<ListEssayPapersResponseV2>('/practice/essay/papers', {
    params: filters,
  });
}

export function usePracticeCenter(): UseQueryResult<PracticeCenterResponseV2> {
  return useQuery<PracticeCenterResponseV2>({
    queryKey: practiceContentKeys.center(),
    queryFn: fetchPracticeCenter,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useXingceCategories(
  filters: XingceCategoriesQuery = {},
): UseQueryResult<ListXingceCategoriesResponseV2> {
  return useQuery<ListXingceCategoriesResponseV2>({
    queryKey: practiceContentKeys.xingceCategories(filters),
    queryFn: () => fetchXingceCategories(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useXingcePapers(
  filters: XingcePapersQuery = {},
): UseQueryResult<ListXingcePapersResponseV2> {
  return useQuery<ListXingcePapersResponseV2>({
    queryKey: practiceContentKeys.xingcePapers(filters),
    queryFn: () => fetchXingcePapers(filters),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useEssayCategories(
  filters: EssayCategoriesQuery = {},
): UseQueryResult<ListEssayCategoriesResponseV2> {
  return useQuery<ListEssayCategoriesResponseV2>({
    queryKey: practiceContentKeys.essayCategories(filters),
    queryFn: () => fetchEssayCategories(filters),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function useEssayPapers(
  filters: EssayPapersQuery = {},
): UseQueryResult<ListEssayPapersResponseV2> {
  return useQuery<ListEssayPapersResponseV2>({
    queryKey: practiceContentKeys.essayPapers(filters),
    queryFn: () => fetchEssayPapers(filters),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

