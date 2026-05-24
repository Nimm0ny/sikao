import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { shouldRetry } from '@sikao/shared-utils';

import { api } from '../request';
import { invalidateSessionSurface, practiceSessionKeys } from './sessionQueries';
import type {
  MockExamCountdownResponseV2,
  OperationAckV2,
  SessionLifecycleResponseV2,
  SessionTimingReportV2,
  TimingBaselineResponseV2,
  TimingEventBatchAckV2,
  TimingEventBatchRequestV2,
} from '../types/practice';

export function fetchPracticeSessionCountdown(
  sessionId: number,
): Promise<MockExamCountdownResponseV2> {
  return api.get<MockExamCountdownResponseV2>(`/practice/sessions/${sessionId}/countdown`);
}

export function discardPracticeSession(sessionId: number): Promise<SessionLifecycleResponseV2> {
  return api.post<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/discard`);
}

export function postPracticeSessionHeartbeat(sessionId: number): Promise<SessionLifecycleResponseV2> {
  return api.post<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/heartbeat`);
}

export function fetchPracticeSessionLifecycle(
  sessionId: number,
): Promise<SessionLifecycleResponseV2> {
  return api.get<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/lifecycle`);
}

export function pausePracticeSession(sessionId: number): Promise<SessionLifecycleResponseV2> {
  return api.post<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/pause`);
}

export function resumePracticeSession(sessionId: number): Promise<SessionLifecycleResponseV2> {
  return api.post<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/resume`);
}

export function startPracticeSession(sessionId: number): Promise<SessionLifecycleResponseV2> {
  return api.post<SessionLifecycleResponseV2>(`/practice/sessions/${sessionId}/start`);
}

export function submitPracticeSession(sessionId: number): Promise<OperationAckV2> {
  return api.post<OperationAckV2>(`/practice/sessions/${sessionId}/submit`);
}

export function fetchPracticeTimingReport(
  sessionId: number,
): Promise<SessionTimingReportV2> {
  return api.get<SessionTimingReportV2>(`/practice/sessions/${sessionId}/timing-report`);
}

export function postPracticeTimingEvents(
  sessionId: number,
  payload: TimingEventBatchRequestV2,
): Promise<TimingEventBatchAckV2> {
  return api.post<TimingEventBatchAckV2, TimingEventBatchRequestV2>(
    `/practice/sessions/${sessionId}/timing/events`,
    payload,
  );
}

export function fetchTimingBaseline(questionId: number): Promise<TimingBaselineResponseV2> {
  return api.get<TimingBaselineResponseV2>(`/practice/questions/${questionId}/timing-baseline`);
}

export function usePracticeSessionCountdown(
  sessionId: number,
): UseQueryResult<MockExamCountdownResponseV2> {
  return useQuery<MockExamCountdownResponseV2>({
    queryKey: practiceSessionKeys.countdown(sessionId),
    queryFn: () => fetchPracticeSessionCountdown(sessionId),
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
    refetchInterval: 1000,
  });
}

function useLifecycleMutation(
  mutationFn: (sessionId: number) => Promise<SessionLifecycleResponseV2>,
): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  const queryClient = useQueryClient();
  return useMutation<SessionLifecycleResponseV2, unknown, number>({
    mutationFn,
    retry: false,
    onSuccess: (_data, sessionId) => {
      invalidateSessionSurface(queryClient, sessionId);
    },
  });
}

export function useDiscardPracticeSession(): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  return useLifecycleMutation(discardPracticeSession);
}

export function usePracticeSessionHeartbeat(): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  return useLifecycleMutation(postPracticeSessionHeartbeat);
}

export function usePracticeSessionLifecycle(
  sessionId: number,
): UseQueryResult<SessionLifecycleResponseV2> {
  return useQuery<SessionLifecycleResponseV2>({
    queryKey: practiceSessionKeys.lifecycle(sessionId),
    queryFn: () => fetchPracticeSessionLifecycle(sessionId),
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
  });
}

export function usePausePracticeSession(): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  return useLifecycleMutation(pausePracticeSession);
}

export function useResumePracticeSession(): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  return useLifecycleMutation(resumePracticeSession);
}

export function useStartPracticeSession(): UseMutationResult<SessionLifecycleResponseV2, unknown, number> {
  return useLifecycleMutation(startPracticeSession);
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

export function usePracticeTimingReport(
  sessionId: number,
): UseQueryResult<SessionTimingReportV2> {
  return useQuery<SessionTimingReportV2>({
    queryKey: practiceSessionKeys.timingReport(sessionId),
    queryFn: () => fetchPracticeTimingReport(sessionId),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: sessionId > 0,
  });
}

export function usePostPracticeTimingEvents(): UseMutationResult<
  TimingEventBatchAckV2,
  unknown,
  { readonly sessionId: number; readonly payload: TimingEventBatchRequestV2 }
> {
  const queryClient = useQueryClient();
  return useMutation<
    TimingEventBatchAckV2,
    unknown,
    { readonly sessionId: number; readonly payload: TimingEventBatchRequestV2 }
  >({
    mutationFn: ({ sessionId, payload }) => postPracticeTimingEvents(sessionId, payload),
    retry: false,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.timingReport(vars.sessionId) });
      void queryClient.invalidateQueries({ queryKey: practiceSessionKeys.detail(vars.sessionId) });
    },
  });
}

export function useTimingBaseline(
  questionId: number,
): UseQueryResult<TimingBaselineResponseV2> {
  return useQuery<TimingBaselineResponseV2>({
    queryKey: practiceSessionKeys.timingBaseline(questionId),
    queryFn: () => fetchTimingBaseline(questionId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: questionId > 0,
  });
}
