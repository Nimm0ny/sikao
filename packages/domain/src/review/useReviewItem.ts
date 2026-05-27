import { useMemo } from 'react';

import {
  useAddReviewItemToPlan,
  useArchiveReviewItem,
  useGraduateReviewItem,
  useRedoReviewItem,
  useRestoreReviewItem,
  useReviewItemQuery,
  useSubmitReviewAttempt,
} from '@sikao/api-client/queries/reviewQueries';

export function useReviewItem(itemId: number) {
  const query = useReviewItemQuery(itemId);
  const redoMutation = useRedoReviewItem(itemId);
  const addToPlanMutation = useAddReviewItemToPlan(itemId);
  const graduateMutation = useGraduateReviewItem(itemId);
  const archiveMutation = useArchiveReviewItem(itemId);
  const restoreMutation = useRestoreReviewItem(itemId);
  const submitAttemptMutation = useSubmitReviewAttempt(itemId);

  return useMemo(
    () => ({
      ...query,
      item: query.data?.item ?? null,
      history: query.data?.history ?? [],
      actions: query.data?.actions ?? [],
      metadata: query.data?.metadata ?? {},
      redoMutation,
      addToPlanMutation,
      graduateMutation,
      archiveMutation,
      restoreMutation,
      submitAttemptMutation,
    }),
    [
      addToPlanMutation,
      archiveMutation,
      graduateMutation,
      query,
      redoMutation,
      restoreMutation,
      submitAttemptMutation,
    ],
  );
}
