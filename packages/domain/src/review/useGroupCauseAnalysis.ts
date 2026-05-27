import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  buildCauseAnalysisGroupSignature,
  postCauseAnalysisFeedback,
  patchCauseAnalysisDimension,
  useCauseTags,
  useCreateCauseAnalysisGroup,
} from '@sikao/api-client/queries/causeAnalysisQueries';
import type {
  CauseAnalysisFeedbackRequestV2,
  CauseAnalysisGroupRequestV2,
  CauseDimensionOverrideRequestV2,
} from '@sikao/api-client/types/review';

export function useGroupCauseAnalysis() {
  const tagsQuery = useCauseTags();
  const createMutation = useCreateCauseAnalysisGroup();
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof createMutation.mutateAsync>> | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

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

  async function runGroupAnalysis(payload: CauseAnalysisGroupRequestV2) {
    const response = await createMutation.mutateAsync(payload);
    setAnalysis(response);
    setSignature(buildCauseAnalysisGroupSignature(payload.itemIds));
    return response;
  }

  return useMemo(
    () => ({
      tagsQuery,
      createMutation,
      overrideMutation,
      feedbackMutation,
      analysis,
      signature,
      runGroupAnalysis,
      clearAnalysis: () => {
        setAnalysis(null);
        setSignature(null);
      },
    }),
    [analysis, createMutation, feedbackMutation, overrideMutation, signature, tagsQuery],
  );
}
