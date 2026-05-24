import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import { toPracticeMutationId } from './practiceId';
import type {
  ActiveSessionsResponseV2,
  OperationAckV2,
  PracticeAnswerFlagRequestV2,
  PracticeAnswerUpsertRequestV2,
  PracticePersistentFlagRequestV2,
  PracticeSessionCreateRequestV2,
  PracticeSessionEnvelopeV2,
  PracticeSessionItemV2,
  PracticeSessionResultResponseV2,
} from '../types/practice';

export const practiceSessionKeys = {
  all: ['practice-session-v2'] as const,
  active: () => ['practice-session-v2', 'active'] as const,
  detail: (sessionId: number) => ['practice-session-v2', 'detail', sessionId] as const,
  lifecycle: (sessionId: number) => ['practice-session-v2', 'lifecycle', sessionId] as const,
  countdown: (sessionId: number) => ['practice-session-v2', 'countdown', sessionId] as const,
  result: (sessionId: number) => ['practice-session-v2', 'result', sessionId] as const,
  timingReport: (sessionId: number) => ['practice-session-v2', 'timing-report', sessionId] as const,
  timingBaseline: (questionId: number) => ['practice-session-v2', 'timing-baseline', questionId] as const,
} as const;

export function invalidateSessionSurface(queryClient: ReturnType<typeof useQueryClient>, sessionId: number): void {
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.detail(sessionId) });
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.lifecycle(sessionId) });
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.countdown(sessionId) });
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.result(sessionId) });
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.timingReport(sessionId) });
  void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.active() });
}

export function createPracticeSession(
  payload: PracticeSessionCreateRequestV2,
): Promise<PracticeSessionEnvelopeV2> {
  return api.post<PracticeSessionEnvelopeV2, PracticeSessionCreateRequestV2>('/practice/sessions', payload);
}

export function fetchActivePracticeSessions(): Promise<ActiveSessionsResponseV2> {
  return api.get<ActiveSessionsResponseV2>('/practice/sessions/active');
}

export function fetchPracticeSession(sessionId: number): Promise<PracticeSessionEnvelopeV2> {
  return api.get<PracticeSessionEnvelopeV2>(`/practice/sessions/${sessionId}`);
}

export function savePracticeSessionAnswers(
  sessionId: number,
  payload: PracticeAnswerUpsertRequestV2,
): Promise<OperationAckV2> {
  return api.post<OperationAckV2, PracticeAnswerUpsertRequestV2>(
    `/practice/sessions/${sessionId}/answers`,
    payload,
  );
}

export function flagPracticeSessionAnswer(
  sessionId: number | string,
  answerId: number | string,
  payload: PracticeAnswerFlagRequestV2,
): Promise<PracticeSessionItemV2> {
  const numericSessionId = toPracticeMutationId(sessionId, 'sessionId');
  const numericAnswerId = toPracticeMutationId(answerId, 'answerId');
  return api.post<PracticeSessionItemV2, PracticeAnswerFlagRequestV2>(
    `/practice/sessions/${numericSessionId}/answers/${numericAnswerId}/flag`,
    payload,
  );
}

export function viewPracticeSessionSolution(
  sessionId: number | string,
  answerId: number | string,
): Promise<PracticeSessionItemV2> {
  const numericSessionId = toPracticeMutationId(sessionId, 'sessionId');
  const numericAnswerId = toPracticeMutationId(answerId, 'answerId');
  return api.post<PracticeSessionItemV2>(
    `/practice/sessions/${numericSessionId}/answers/${numericAnswerId}/view-solution`,
  );
}

export function submitPracticeSession(sessionId: number): Promise<OperationAckV2> {
  return api.post<OperationAckV2>(`/practice/sessions/${sessionId}/submit`);
}

export function createPersistentPracticeFlag(
  sessionId: number | string,
  payload: PracticePersistentFlagRequestV2,
): Promise<PracticeSessionItemV2> {
  const numericSessionId = toPracticeMutationId(sessionId, 'sessionId');
  return api.post<PracticeSessionItemV2, PracticePersistentFlagRequestV2>(
    `/practice/sessions/${numericSessionId}/persistent-flag`,
    payload,
  );
}

export function fetchPracticeSessionResult(
  sessionId: number,
): Promise<PracticeSessionResultResponseV2> {
  return api.get<PracticeSessionResultResponseV2>(`/practice/sessions/${sessionId}/result`);
}

export function useCreatePracticeSession(): UseMutationResult<
  PracticeSessionEnvelopeV2,
  unknown,
  PracticeSessionCreateRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation<PracticeSessionEnvelopeV2, unknown, PracticeSessionCreateRequestV2>({
    mutationFn: createPracticeSession,
    retry: false,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.active() });
      void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.detail(data.id) });
    },
  });
}

export function useActivePracticeSessions(): UseQueryResult<ActiveSessionsResponseV2> {
  return useQuery<ActiveSessionsResponseV2>({
    queryKey: practiceSessionKeys.active(),
    queryFn: fetchActivePracticeSessions,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
  });
}

export function usePracticeSession(
  sessionId: number,
): UseQueryResult<PracticeSessionEnvelopeV2> {
  return useQuery<PracticeSessionEnvelopeV2>({
    queryKey: practiceSessionKeys.detail(sessionId),
    queryFn: () => fetchPracticeSession(sessionId),
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
  });
}

export function useSavePracticeSessionAnswers(): UseMutationResult<
  OperationAckV2,
  unknown,
  { readonly sessionId: number; readonly payload: PracticeAnswerUpsertRequestV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    OperationAckV2,
    unknown,
    { readonly sessionId: number; readonly payload: PracticeAnswerUpsertRequestV2 }
  >({
    mutationFn: ({ sessionId, payload }) => savePracticeSessionAnswers(sessionId, payload),
    retry: false,
    onSuccess: (_data, vars) => {
      invalidateSessionSurface(queryClient, vars.sessionId);
    },
  });
}

export function useFlagPracticeSessionAnswer(): UseMutationResult<
  PracticeSessionItemV2,
  unknown,
  { readonly sessionId: number | string; readonly answerId: number | string; readonly payload: PracticeAnswerFlagRequestV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    PracticeSessionItemV2,
    unknown,
    { readonly sessionId: number | string; readonly answerId: number | string; readonly payload: PracticeAnswerFlagRequestV2 }
  >({
    mutationFn: ({ sessionId, answerId, payload }) =>
      flagPracticeSessionAnswer(sessionId, answerId, payload),
    retry: false,
    onSuccess: (_data, vars) => {
      invalidateSessionSurface(queryClient, toPracticeMutationId(vars.sessionId, 'sessionId'));
    },
  });
}

export function useViewPracticeSessionSolution(): UseMutationResult<
  PracticeSessionItemV2,
  unknown,
  { readonly sessionId: number | string; readonly answerId: number | string }
> {
  const queryClient = useQueryClient();
  return useMutation<
    PracticeSessionItemV2,
    unknown,
    { readonly sessionId: number | string; readonly answerId: number | string }
  >({
    mutationFn: ({ sessionId, answerId }) => viewPracticeSessionSolution(sessionId, answerId),
    retry: false,
    onSuccess: (_data, vars) => {
      invalidateSessionSurface(queryClient, toPracticeMutationId(vars.sessionId, 'sessionId'));
    },
  });
}

export function useSubmitPracticeSession(): UseMutationResult<OperationAckV2, unknown, number> {
  const queryClient = useQueryClient();
  return useMutation<OperationAckV2, unknown, number>({
    mutationFn: submitPracticeSession,
    retry: false,
    onSuccess: (_data, sessionId) => {
      invalidateSessionSurface(queryClient, sessionId);
    },
  });
}

export function useCreatePersistentPracticeFlag(): UseMutationResult<
  PracticeSessionItemV2,
  unknown,
  { readonly sessionId: number | string; readonly payload: PracticePersistentFlagRequestV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    PracticeSessionItemV2,
    unknown,
    { readonly sessionId: number | string; readonly payload: PracticePersistentFlagRequestV2 }
  >({
    mutationFn: ({ sessionId, payload }) => createPersistentPracticeFlag(sessionId, payload),
    retry: false,
    onSuccess: (_data, vars) => {
      invalidateSessionSurface(queryClient, toPracticeMutationId(vars.sessionId, 'sessionId'));
    },
  });
}

export function usePracticeSessionResult(
  sessionId: number,
): UseQueryResult<PracticeSessionResultResponseV2> {
  return useQuery<PracticeSessionResultResponseV2>({
    queryKey: practiceSessionKeys.result(sessionId),
    queryFn: () => fetchPracticeSessionResult(sessionId),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
  });
}
