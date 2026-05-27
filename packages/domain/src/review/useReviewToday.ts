import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import {
  buildReviewItemsQueryOptions,
  useDashboardTodayReview,
  useReviewItemsQuery,
} from '@sikao/api-client/queries/reviewQueries';
import { useWeeklySummary } from '@sikao/api-client/queries/weeklyReviewQueries';
import type { ReviewItemV2 } from '@sikao/api-client/types/review';

import { useRecentAnswers } from './useRecentAnswers';
import { useSmartReviewCards } from './useSmartReviewCards';

const REVIEW_AGGREGATION_PAGE_SIZE = 100;

export function useReviewToday() {
  const todayQuery = useDashboardTodayReview();
  const weeklySummaryQuery = useWeeklySummary();
  const reviewItemsBaseQuery = useReviewItemsQuery({
    page: 1,
    page_size: REVIEW_AGGREGATION_PAGE_SIZE,
  });
  const recentAnswersQuery = useRecentAnswers();
  const totalItems = reviewItemsBaseQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / REVIEW_AGGREGATION_PAGE_SIZE));
  const additionalReviewItemQueries = useQueries({
    queries: Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => {
      const page = index + 2;
      return buildReviewItemsQueryOptions({
        page,
        page_size: REVIEW_AGGREGATION_PAGE_SIZE,
      });
    }),
  });
  const aggregatedReviewItems: readonly ReviewItemV2[] = useMemo(
    () => [
      ...(reviewItemsBaseQuery.data?.items ?? []),
      ...additionalReviewItemQueries.flatMap((query) => query.data?.items ?? []),
    ],
    [additionalReviewItemQueries, reviewItemsBaseQuery.data?.items],
  );
  const reviewItemsQuery = useMemo(
    () => ({
      ...reviewItemsBaseQuery,
      data: reviewItemsBaseQuery.data == null
        ? undefined
        : {
            ...reviewItemsBaseQuery.data,
            items: aggregatedReviewItems,
            page: 1,
            pageSize: Math.max(
              reviewItemsBaseQuery.data.pageSize,
              aggregatedReviewItems.length,
            ),
          },
      isLoading:
        reviewItemsBaseQuery.isLoading ||
        additionalReviewItemQueries.some((query) => query.isLoading),
      isError:
        reviewItemsBaseQuery.isError ||
        additionalReviewItemQueries.some((query) => query.isError),
    }),
    [additionalReviewItemQueries, aggregatedReviewItems, reviewItemsBaseQuery],
  );

  const smartCards = useSmartReviewCards({
    items: aggregatedReviewItems,
    recentAnswers: recentAnswersQuery.items,
  });

  return useMemo(
    () => ({
      todayQuery,
      weeklySummaryQuery,
      reviewItemsQuery,
      recentAnswersQuery,
      queueItems: todayQuery.data?.items ?? [],
      smartCards,
      isLoading:
        todayQuery.isLoading ||
        weeklySummaryQuery.isLoading ||
        reviewItemsQuery.isLoading ||
        recentAnswersQuery.isLoading,
      isError:
        todayQuery.isError ||
        weeklySummaryQuery.isError ||
        reviewItemsQuery.isError ||
        recentAnswersQuery.isError,
    }),
    [recentAnswersQuery, reviewItemsQuery, smartCards, todayQuery, weeklySummaryQuery],
  );
}
