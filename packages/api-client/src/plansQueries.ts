import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { homeQueryKeys } from './homeQueryKeys';
import { api } from './request';
import type {
  EventWindowFilters,
  PlanEventAggregateBatchRequestV2,
  PlanEventAggregateBatchResponseV2,
  EventWindowResponseV2,
  PlanAdjustmentListResponseV2,
  PlanAdjustmentReadV2,
  PlanEventReadV2,
  PlanListResponseV2,
  PlanReadV2,
} from './types/home';

export function fetchPlans(): Promise<PlanListResponseV2> {
  return api.get<PlanListResponseV2>('/plans');
}

export function fetchPlan(planId: number): Promise<PlanReadV2> {
  return api.get<PlanReadV2>(`/plans/${planId}`);
}

export function fetchEvents(filters: EventWindowFilters): Promise<EventWindowResponseV2> {
  return api.get<EventWindowResponseV2>('/plans/events', {
    params: {
      from: filters.from,
      to: filters.to,
      include_practice_blocks: filters.includePracticeBlocks ?? true,
      tz: filters.tz ?? 'Asia/Shanghai',
    },
  });
}

function normalizeAggregateEventIds(eventIds: readonly string[]): string[] {
  return Array.from(new Set(eventIds)).sort((left, right) => left.localeCompare(right));
}

export function fetchEventAggregates(
  payload: PlanEventAggregateBatchRequestV2,
): Promise<PlanEventAggregateBatchResponseV2> {
  return api.post<PlanEventAggregateBatchResponseV2, PlanEventAggregateBatchRequestV2>(
    '/plans/events/aggregates',
    { eventIds: normalizeAggregateEventIds(payload.eventIds) },
  );
}

export function fetchEvent(eventId: string | number): Promise<PlanEventReadV2> {
  return api.get<PlanEventReadV2>(`/plans/events/${eventId}`);
}

export function fetchAdjustments(status?: string | null): Promise<PlanAdjustmentListResponseV2> {
  return api.get<PlanAdjustmentListResponseV2>('/plans/adjustments', {
    params: status ? { status } : undefined,
  });
}

export function fetchAdjustment(adjustmentId: number): Promise<PlanAdjustmentReadV2> {
  return api.get<PlanAdjustmentReadV2>(`/plans/adjustments/${adjustmentId}`);
}

export function usePlansList(): UseQueryResult<PlanListResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.list(),
    queryFn: fetchPlans,
  });
}

export function usePlan(planId: number): UseQueryResult<PlanReadV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.detail(planId),
    queryFn: () => fetchPlan(planId),
    enabled: Number.isFinite(planId),
  });
}

export function useEvents(filters: EventWindowFilters): UseQueryResult<EventWindowResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.events(filters),
    queryFn: () => fetchEvents(filters),
  });
}

export function useEventAggregates(
  eventIds: readonly string[],
): UseQueryResult<PlanEventAggregateBatchResponseV2> {
  const normalizedEventIds = normalizeAggregateEventIds(eventIds);
  return useQuery({
    queryKey: homeQueryKeys.plans.eventAggregates(normalizedEventIds),
    queryFn: () => fetchEventAggregates({ eventIds: normalizedEventIds }),
    enabled: normalizedEventIds.length > 0,
  });
}

export function useEvent(eventId: string | number): UseQueryResult<PlanEventReadV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.event(eventId),
    queryFn: () => fetchEvent(eventId),
    enabled: String(eventId).length > 0,
  });
}

export function useAdjustmentsPending(status = 'pending'): UseQueryResult<PlanAdjustmentListResponseV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.adjustments(status),
    queryFn: () => fetchAdjustments(status),
  });
}

export function useAdjustment(adjustmentId: number): UseQueryResult<PlanAdjustmentReadV2> {
  return useQuery({
    queryKey: homeQueryKeys.plans.adjustment(adjustmentId),
    queryFn: () => fetchAdjustment(adjustmentId),
    enabled: Number.isFinite(adjustmentId),
  });
}

export type { RecurringScopeConfig, StreamingMutationVariables } from './plansMutations';
export {
  acceptAdjustment,
  activatePlan,
  archivePlan,
  bulkDeleteEvents,
  createEvent,
  createPlan,
  deleteEvent,
  detectEventConflicts,
  pausePlan,
  rejectAdjustment,
  restoreEvent,
  streamAutoGeneratePlan,
  streamRegenerateRange,
  updateEvent,
  updatePlan,
  useAcceptAdjustment,
  useActivatePlan,
  useArchivePlan,
  useAutoGeneratePlan,
  useAutoRegenerateRange,
  useBulkDeleteEvents,
  useCreateEvent,
  useCreatePlan,
  useDeleteEvent,
  useDetectConflicts,
  useRejectAdjustment,
  useRestoreEvent,
  useUpdateEvent,
  useUpdatePlan,
} from './plansMutations';
