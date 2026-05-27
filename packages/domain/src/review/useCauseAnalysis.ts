import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  postCauseAnalysisFeedback,
  patchCauseAnalysisDimension,
  useCauseTags,
  useCreateCauseAnalysisSingle,
} from '@sikao/api-client/queries/causeAnalysisQueries';
import type {
  CauseAnalysisFeedbackRequestV2,
  CauseAnalysisRequestV2,
  CauseDimensionOverrideRequestV2,
} from '@sikao/api-client/types/review';

export function useCauseAnalysis(itemId: number) {
  const tagsQuery = useCauseTags();
  const createMutation = useCreateCauseAnalysisSingle(itemId);
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof createMutation.mutateAsync>> | null>(null);

  const overrideMutation = useMutation({
    mutationFn: ({
      analysisId,
      dimensionIndex,
      payload,
    }: {
      readonly analysisId: number;
      readonly dimensionIndex: number;
      readonly payload: CauseDimensionOverrideRequestV2;
    }) => patchCauseAnalysisDimension(analysisId, dimensionIndex, payload),
    retry: false,
    onSuccess: (response) => {
      setAnalysis(response);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({
      analysisId,
      payload,
    }: {
      readonly analysisId: number;
      readonly payload: CauseAnalysisFeedbackRequestV2;
    }) => postCauseAnalysisFeedback(analysisId, payload),
    retry: false,
  });

  async function runAnalysis(payload: CauseAnalysisRequestV2 = { mode: 'single' }) {
    const response = await createMutation.mutateAsync(payload);
    setAnalysis(response);
    return response;
  }

  return useMemo(
    () => ({
      tagsQuery,
      createMutation,
      overrideMutation,
      feedbackMutation,
      analysis,
      runAnalysis,
      clearAnalysis: () => setAnalysis(null),
    }),
    [analysis, createMutation, feedbackMutation, overrideMutation, tagsQuery],
  );
}
