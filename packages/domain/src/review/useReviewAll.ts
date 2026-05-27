import { useMemo } from 'react';

import type { ReviewItemsQuery } from '@sikao/api-client/types/review';

import { useReviewItems } from './useReviewItems';

export interface UseReviewAllOptions {
  readonly filters?: ReviewItemsQuery;
}

export function useReviewAll(options: UseReviewAllOptions = {}) {
  const reviewItems = useReviewItems({ initialFilters: options.filters });
  return useMemo(
    () => ({
      ...reviewItems,
      segmentItems: reviewItems.items,
    }),
    [reviewItems],
  );
}
