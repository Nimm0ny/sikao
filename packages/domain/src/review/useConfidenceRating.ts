import { useCallback, useMemo, useState } from 'react';

import type { ReviewConfidenceLevel, ReviewAttemptRequestV2 } from '@sikao/api-client/types/review';

import { useSubmitReviewAttempt } from '@sikao/api-client/queries/reviewQueries';

const CONFIDENCE_OPTIONS: readonly ReviewConfidenceLevel[] = [
  'guess',
  'unsure',
  'likely',
  'certain',
];

export interface UseConfidenceRatingOptions {
  readonly itemId: number;
  readonly forced?: boolean;
}

export function useConfidenceRating(options: UseConfidenceRatingOptions) {
  const [confidence, setConfidence] = useState<ReviewConfidenceLevel | null>(null);
  const [recallText, setRecallText] = useState('');
  const submitAttemptMutation = useSubmitReviewAttempt(options.itemId);

  const reset = useCallback(() => {
    setConfidence(null);
    setRecallText('');
  }, []);

  const submit = useCallback(
    async (payload: Omit<ReviewAttemptRequestV2, 'confidence' | 'recallText'>) => {
      return submitAttemptMutation.mutateAsync({
        ...payload,
        confidence,
        recallText: recallText.trim() || null,
      });
    },
    [confidence, recallText, submitAttemptMutation],
  );

  return useMemo(
    () => ({
      confidence,
      setConfidence,
      recallText,
      setRecallText,
      options: CONFIDENCE_OPTIONS,
      forced: options.forced ?? false,
      reset,
      submit,
      submitAttemptMutation,
    }),
    [confidence, options.forced, recallText, reset, submit, submitAttemptMutation],
  );
}
