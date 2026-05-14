/**
 * SIKAO Wave 4 Phase 2D · 单错题 detail 查找 hook.
 *
 * BE 暂无 /wrong-questions/{id} 单题 endpoint. 通过 react-query cache lookup
 * 命中 main page list, 命中即用; cache miss 时 fallback 拉头一页 100 条 list
 * 找 by id (适用直接访问 /wrong-book/:id URL 场景).
 *
 * BE 后续若加 GET endpoint, 直接替换 fetcher, 调用方接口不动.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWrongQuestions, wrongBookKeys } from '@sikao/api-client/apiQueries';
import type { WrongQuestionDetailV2 } from '@sikao/api-client/types/api';

export interface UseWrongQuestionItemResult {
  readonly item: WrongQuestionDetailV2 | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function useWrongQuestionItem(
  questionId: number,
): UseWrongQuestionItemResult {
  const queryClient = useQueryClient();
  const cachedItem = useMemo(() => {
    const cache = queryClient.getQueryCache();
    for (const q of cache.findAll({ queryKey: wrongBookKeys.all })) {
      const data = q.state.data as
        | { readonly items?: readonly WrongQuestionDetailV2[] }
        | undefined;
      if (data?.items === undefined) continue;
      const hit = data.items.find((it) => it.questionId === questionId);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }, [queryClient, questionId]);

  const fallbackQuery = useQuery({
    queryKey: ['wrong-book', 'detail-fallback', questionId],
    queryFn: () => fetchWrongQuestions({ page: 1, pageSize: 100 }),
    enabled: cachedItem === undefined,
    staleTime: 1000 * 60 * 5,
  });

  const item =
    cachedItem ??
    fallbackQuery.data?.items.find((it) => it.questionId === questionId);

  return {
    item,
    isLoading: cachedItem === undefined && fallbackQuery.isLoading,
    isError: cachedItem === undefined && fallbackQuery.isError,
  };
}
