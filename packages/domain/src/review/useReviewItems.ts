import { useCallback, useMemo, useState } from 'react';

import { useBatchReviewItems, useReviewItemsQuery } from '@sikao/api-client/queries/reviewQueries';
import type { ReviewBatchRequestV2, ReviewItemsQuery } from '@sikao/api-client/types/review';

export interface UseReviewItemsOptions {
  readonly initialFilters?: ReviewItemsQuery;
}

export function useReviewItems(options: UseReviewItemsOptions = {}) {
  const [filters, setFilters] = useState<ReviewItemsQuery>(options.initialFilters ?? {});
  const [selectedIds, setSelectedIds] = useState<readonly number[]>([]);
  const query = useReviewItemsQuery(filters);
  const batchMutation = useBatchReviewItems();

  const toggleSelected = useCallback((itemId: number) => {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((candidate) => candidate !== itemId)
        : [...current, itemId],
    );
  }, []);

  const replaceSelected = useCallback((nextIds: readonly number[]) => {
    setSelectedIds([...nextIds]);
  }, []);

  const clearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const runBatchAction = useCallback(
    async (payload: ReviewBatchRequestV2) => {
      const result = await batchMutation.mutateAsync(payload);
      clearSelected();
      return result;
    },
    [batchMutation, clearSelected],
  );

  const items = query.data?.items ?? [];
  return useMemo(
    () => ({
      ...query,
      items,
      total: query.data?.total ?? 0,
      page: query.data?.page ?? 1,
      pageSize: query.data?.pageSize ?? 0,
      filters,
      setFilters,
      selectedIds,
      selectedCount: selectedIds.length,
      toggleSelected,
      replaceSelected,
      clearSelected,
      batchMutation,
      runBatchAction,
    }),
    [
      batchMutation,
      clearSelected,
      filters,
      items,
      query,
      replaceSelected,
      runBatchAction,
      selectedIds,
      setFilters,
      toggleSelected,
    ],
  );
}
