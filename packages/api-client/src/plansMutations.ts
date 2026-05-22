import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { collectDoneFrame, streamJsonSsePost } from './homeStream';
import { homeQueryKeys } from './homeQueryKeys';
import { withIdempotencyHeader } from './idempotency';
import { api } from './request';
import type {
  EventConflictsRequestV2,
  EventConflictsResponseV2,
  HomePlanGenerateDoneFrame,
  HomePlanGenerateStreamFrame,
  HomePlanRegenerateDoneFrame,
  HomePlanRegenerateStreamFrame,
  PlanAdjustmentRejectRequestV2,
  PlanAutoGenerateRequestV2,
  PlanCreateRequestV2,
  PlanEventBulkDeleteRequestV2,
  PlanEventBulkDeleteResponseV2,
  PlanEventCreateRequestV2,
  PlanEventReadV2,
  PlanEventUpdateRequestV2,
  PlanReadV2,
  PlanRegenerateRangeRequestV2,
  PlanUpdateRequestV2,
} from './types/home';

export interface RecurringScopeConfig {
  readonly scope?: string;
}

export interface StreamingMutationVariables<TPayload, TFrame> {
  readonly payload: TPayload;
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
  readonly onProgress?: (frame: TFrame) => void;
}

function invalidatePlanRuntimeQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.plans.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.dashboard.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.progress.all() });
  void queryClient.invalidateQueries({ queryKey: homeQueryKeys.recommendations.all() });
}

export function createPlan(payload: PlanCreateRequestV2): Promise<PlanReadV2> {
  return api.post<PlanReadV2, PlanCreateRequestV2>('/plans', payload);
}

export function updatePlan(planId: number, payload: PlanUpdateRequestV2): Promise<PlanReadV2> {
  return api.put<PlanReadV2, PlanUpdateRequestV2>(`/plans/${planId}`, payload);
}

export function archivePlan(planId: number): Promise<PlanReadV2> {
  return api.post<PlanReadV2>(`/plans/${planId}/archive`);
}

export function activatePlan(planId: number): Promise<PlanReadV2> {
  return api.post<PlanReadV2>(`/plans/${planId}/activate`);
}

export function pausePlan(planId: number): Promise<PlanReadV2> {
  return api.post<PlanReadV2>(`/plans/${planId}/pause`);
}

export function createEvent(payload: PlanEventCreateRequestV2): Promise<PlanEventReadV2> {
  return api.post<PlanEventReadV2, PlanEventCreateRequestV2>('/plans/events', payload);
}

export function updateEvent(
  eventId: string | number,
  payload: PlanEventUpdateRequestV2,
  options: RecurringScopeConfig = {},
): Promise<PlanEventReadV2> {
  return api.patch<PlanEventReadV2, PlanEventUpdateRequestV2>(
    `/plans/events/${eventId}`,
    payload,
    { params: options.scope ? { scope: options.scope } : undefined },
  );
}

export function deleteEvent(
  eventId: string | number,
  options: RecurringScopeConfig = {},
): Promise<{ ok: boolean; status: string }> {
  return api.delete<{ ok: boolean; status: string }>(`/plans/events/${eventId}`, {
    params: options.scope ? { scope: options.scope } : undefined,
  });
}

export function bulkDeleteEvents(
  payload: PlanEventBulkDeleteRequestV2,
): Promise<PlanEventBulkDeleteResponseV2> {
  return api.post<PlanEventBulkDeleteResponseV2, PlanEventBulkDeleteRequestV2>(
    '/plans/events/bulk-delete',
    payload,
  );
}

export function detectEventConflicts(
  payload: EventConflictsRequestV2,
): Promise<EventConflictsResponseV2> {
  return api.post<EventConflictsResponseV2, EventConflictsRequestV2>(
    '/plans/events/conflicts',
    payload,
  );
}

export function restoreEvent(eventId: string | number): Promise<PlanEventReadV2> {
  return api.post<PlanEventReadV2>(`/plans/events/${eventId}/restore`);
}

export function acceptAdjustment(adjustmentId: number): Promise<{ ok: boolean; status: string }> {
  return api.post<{ ok: boolean; status: string }>(
    `/plans/adjustments/${adjustmentId}/accept`,
  );
}

export function rejectAdjustment(
  adjustmentId: number,
  payload: PlanAdjustmentRejectRequestV2,
): Promise<{ ok: boolean; status: string }> {
  return api.post<{ ok: boolean; status: string }, PlanAdjustmentRejectRequestV2>(
    `/plans/adjustments/${adjustmentId}/reject`,
    payload,
  );
}

export function streamAutoGeneratePlan(
  payload: PlanAutoGenerateRequestV2,
  options: {
    readonly signal: AbortSignal;
    readonly idempotencyKey?: string;
  },
): AsyncIterable<HomePlanGenerateStreamFrame> {
  const { key } = withIdempotencyHeader(options.idempotencyKey);
  return streamJsonSsePost<HomePlanGenerateStreamFrame>('/plans/auto-generate', payload, {
    signal: options.signal,
    idempotencyKey: key,
  });
}

export function streamRegenerateRange(
  payload: PlanRegenerateRangeRequestV2,
  options: {
    readonly signal: AbortSignal;
    readonly idempotencyKey?: string;
  },
): AsyncIterable<HomePlanRegenerateStreamFrame> {
  const { key } = withIdempotencyHeader(options.idempotencyKey);
  return streamJsonSsePost<HomePlanRegenerateStreamFrame>(
    '/plans/events/regenerate-range',
    payload,
    {
      signal: options.signal,
      idempotencyKey: key,
    },
  );
}

export function useCreatePlan(): UseMutationResult<PlanReadV2, unknown, PlanCreateRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useUpdatePlan(
  planId: number,
): UseMutationResult<PlanReadV2, unknown, PlanUpdateRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => updatePlan(planId, payload),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useArchivePlan(planId: number): UseMutationResult<PlanReadV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archivePlan(planId),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useActivatePlan(planId: number): UseMutationResult<PlanReadV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => activatePlan(planId),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useCreateEvent(): UseMutationResult<PlanEventReadV2, unknown, PlanEventCreateRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useUpdateEvent(
  eventId: string | number,
  options: RecurringScopeConfig = {},
): UseMutationResult<PlanEventReadV2, unknown, PlanEventUpdateRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => updateEvent(eventId, payload, options),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useDeleteEvent(
  eventId: string | number,
  options: RecurringScopeConfig = {},
): UseMutationResult<{ ok: boolean; status: string }, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteEvent(eventId, options),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useBulkDeleteEvents(): UseMutationResult<
  PlanEventBulkDeleteResponseV2,
  unknown,
  PlanEventBulkDeleteRequestV2
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteEvents,
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useDetectConflicts(): UseMutationResult<
  EventConflictsResponseV2,
  unknown,
  EventConflictsRequestV2
> {
  return useMutation({
    mutationFn: detectEventConflicts,
  });
}

export function useRestoreEvent(
  eventId: string | number,
): UseMutationResult<PlanEventReadV2, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => restoreEvent(eventId),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useAcceptAdjustment(
  adjustmentId: number,
): UseMutationResult<{ ok: boolean; status: string }, unknown, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => acceptAdjustment(adjustmentId),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useRejectAdjustment(
  adjustmentId: number,
): UseMutationResult<{ ok: boolean; status: string }, unknown, PlanAdjustmentRejectRequestV2> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => rejectAdjustment(adjustmentId, payload),
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useAutoGeneratePlan(): UseMutationResult<
  HomePlanGenerateDoneFrame,
  unknown,
  StreamingMutationVariables<PlanAutoGenerateRequestV2, HomePlanGenerateStreamFrame>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, signal, idempotencyKey, onProgress }) => {
      const controller = signal ? null : new AbortController();
      return collectDoneFrame(
        streamAutoGeneratePlan(payload, {
          signal: signal ?? controller!.signal,
          idempotencyKey,
        }),
        onProgress,
      );
    },
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}

export function useAutoRegenerateRange(): UseMutationResult<
  HomePlanRegenerateDoneFrame,
  unknown,
  StreamingMutationVariables<PlanRegenerateRangeRequestV2, HomePlanRegenerateStreamFrame>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, signal, idempotencyKey, onProgress }) => {
      const controller = signal ? null : new AbortController();
      return collectDoneFrame(
        streamRegenerateRange(payload, {
          signal: signal ?? controller!.signal,
          idempotencyKey,
        }),
        onProgress,
      );
    },
    onSuccess: () => {
      invalidatePlanRuntimeQueries(queryClient);
    },
  });
}
