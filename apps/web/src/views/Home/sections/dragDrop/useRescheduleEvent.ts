/*
 * useRescheduleEvent — SIK-139 W2.
 *
 * Why: requirements Requirement 1 locks the write path to the EXISTING
 *      `PATCH /plans/events/{id}` endpoint via the api-client `updateEvent`
 *      function with a `{ startAt, endAt }` payload subset. No new endpoint,
 *      no DTO change. `useUpdateEvent` binds a single eventId at hook-call
 *      time, which does not fit a drag whose target id is only known at drop;
 *      so this hook wraps the same `updateEvent` function in a react-query
 *      mutation keyed by a per-call `eventId` variable, and mirrors the
 *      `invalidatePlanRuntimeQueries` fan-out that `useUpdateEvent` performs
 *      on success (plans / dashboard / progress / recommendations).
 *
 *      AGENT-H1 note: this reuses the api-client `updateEvent` boundary
 *      verbatim (same endpoint, same `PlanEventUpdateRequestV2` shape); it
 *      does not introduce a new cross-service contract. The only reason it
 *      lives in apps/web instead of calling `useUpdateEvent` is the dynamic
 *      eventId; the network boundary is unchanged.
 *
 *      AGENT-H7: the mutation surfaces rejection to the caller (it does not
 *      swallow). Optimistic write + rollback orchestration lives in the drop
 *      handler (MonthGridDnd), which owns the store; this hook stays a thin
 *      network wrapper.
 */
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { homeQueryKeys } from '@sikao/api-client/homeQueryKeys';
import { updateEvent } from '@sikao/api-client/plansQueries';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

export interface RescheduleEventVariables {
  /** Real persisted event id (chip `data-event-id`), the mutation target. */
  readonly eventId: string;
  /** New start in ISO (from `rescheduleEvent`). */
  readonly startAt: string;
  /** New end in ISO (from `rescheduleEvent`). */
  readonly endAt: string;
}

/**
 * Reschedule mutation: PATCH the event's `startAt` / `endAt` only. On success
 * it invalidates the same runtime query families `useUpdateEvent` does so the
 * calendar refetches and the optimistic placeholder can be dropped.
 */
export function useRescheduleEvent(): UseMutationResult<
  PlanEventReadV2,
  unknown,
  RescheduleEventVariables
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, startAt, endAt }: RescheduleEventVariables) =>
      updateEvent(eventId, { startAt, endAt }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: homeQueryKeys.plans.all() });
      void queryClient.invalidateQueries({ queryKey: homeQueryKeys.dashboard.all() });
      void queryClient.invalidateQueries({ queryKey: homeQueryKeys.progress.all() });
      void queryClient.invalidateQueries({ queryKey: homeQueryKeys.recommendations.all() });
    },
  });
}
