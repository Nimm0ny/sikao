/*
 * commitReschedule — SIK-139 W2 (test-coverage extract per W2 review M-1).
 *
 * Why: the drop orchestration (optimistic write → PATCH → success clear /
 *      reject rollback + toast) is the H7 fail-fast critical path. The W2
 *      review (docs/reviews/sik-139-w2.md, finding M-1) flagged it as having
 *      no automated coverage because it lived inline in MonthGridDnd's
 *      onDragEnd, which jsdom cannot drive through a real dnd drop. Extracting
 *      it into a dependency-injected function makes both the success and the
 *      rollback branch unit-testable without fighting dnd-kit's collision
 *      layout. Production behavior is unchanged — MonthGridDnd just calls
 *      this instead of inlining the same five statements.
 *
 *      AGENT-H7: the rollback branch (removeOptimisticEvent + notifyError)
 *      is the documented failure path; there is no silent catch. notifyError
 *      surfaces an explicit user-facing error.
 */

/** The shifted-time decision produced by `resolveCalendarDrop` (reschedule). */
export interface RescheduleCommit {
  readonly eventId: string;
  readonly title: string;
  readonly startAt: string;
  readonly endAt: string;
}

/** Injected effects so the orchestration stays unit-testable. */
export interface RescheduleCommitDeps {
  readonly upsertOptimisticEvent: (
    eventId: string,
    patch: { readonly startAt: string; readonly endAt: string },
  ) => void;
  readonly removeOptimisticEvent: (eventId: string) => void;
  readonly mutate: (
    variables: { readonly eventId: string; readonly startAt: string; readonly endAt: string },
    callbacks: { readonly onSuccess: () => void; readonly onError: () => void },
  ) => void;
  /** Surface an explicit failure to the user (toast). */
  readonly notifyError: (title: string) => void;
}

/**
 * Run the optimistic reschedule commit: write the optimistic patch, fire the
 * PATCH, then on success drop the placeholder (refetch becomes truth) or on
 * failure roll the placeholder back and notify (AGENT-H7).
 */
export function commitReschedule(
  decision: RescheduleCommit,
  deps: RescheduleCommitDeps,
): void {
  const { eventId, title, startAt, endAt } = decision;
  deps.upsertOptimisticEvent(eventId, { startAt, endAt });
  deps.mutate(
    { eventId, startAt, endAt },
    {
      onSuccess: () => {
        // Let the invalidated refetch become the source of truth.
        deps.removeOptimisticEvent(eventId);
      },
      onError: () => {
        // Roll back the optimistic patch and tell the user (H7).
        deps.removeOptimisticEvent(eventId);
        deps.notifyError(title);
      },
    },
  );
}
