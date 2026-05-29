import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import { CalendarPeekContext } from './CalendarPeekContext';
import type { CalendarPeekContextValue, CalendarPeekListEntry } from './types';

/*
 * CalendarPeekProvider — SIK-138 W6.
 *
 * Why: requirements.md Requirement 12 + design.md "Peek Card · Components"
 *      put the open / close / next / prev state machine in a Context so
 *      <MonthCalendarView /> (or any future view) can mount the provider
 *      around its grid and trigger the peek from any chip's click handler.
 *
 *      AGENT-H7 (fail-fast):
 *        - open() throws if list is empty
 *        - open() throws if the event is not found by `id` in the list
 *        - next() / prev() are no-ops when listLength <= 1; they wrap
 *          inside the list scope and never reach outside
 *
 *      AGENT-H6 / D14: this is a thin scope manager. FocusTrap + portal +
 *      body scroll lock live in CalendarPeekCard so server-rendered
 *      consumers can read provider state without forcing a portal mount.
 *
 *      SIK-140 follow-up: successful inline edits must patch the provider
 *      snapshot too, otherwise next/prev round-trips would rehydrate stale
 *      event values from the original open() list.
 */

export interface CalendarPeekProviderProps {
  readonly children: ReactNode;
}

interface PeekState {
  readonly list: ReadonlyArray<CalendarPeekListEntry>;
  readonly index: number;
}

export function CalendarPeekProvider({ children }: CalendarPeekProviderProps) {
  const [state, setState] = useState<PeekState | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (event: PlanEventReadV2, list: ReadonlyArray<CalendarPeekListEntry>) => {
      if (list.length === 0) {
        throw new Error('CalendarPeekProvider: open() requires a non-empty list');
      }
      const index = list.findIndex((entry) => entry.id === event.id);
      if (index === -1) {
        throw new Error(
          `CalendarPeekProvider: event ${event.id} not found in supplied list`,
        );
      }
      // Capture the focused element so close() can restore it. We use a
      // ref instead of state because focus restoration must happen during
      // the same effect tick as portal teardown; reading state would lag.
      lastFocusRef.current = document.activeElement as HTMLElement | null;
      setState({ list, index });
    },
    [],
  );

  const close = useCallback(() => {
    setState(null);
    const restore = lastFocusRef.current;
    lastFocusRef.current = null;
    // Defer focus restore to the next tick so the portal has unmounted
    // before we move focus; otherwise the trap's own cleanup races.
    if (restore && typeof restore.focus === 'function') {
      // RAF avoids the FocusTrap restore stomping on this one in tests.
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
      raf(() => restore.focus());
    }
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      if (prev === null || prev.list.length <= 1) return prev;
      return { list: prev.list, index: (prev.index + 1) % prev.list.length };
    });
  }, []);

  const prev = useCallback(() => {
    setState((current) => {
      if (current === null || current.list.length <= 1) return current;
      return {
        list: current.list,
        index: (current.index - 1 + current.list.length) % current.list.length,
      };
    });
  }, []);

  const commitEvent = useCallback((eventId: string, patch: Partial<PlanEventReadV2>) => {
    setState((current) => {
      if (current === null) {
        throw new Error('CalendarPeekProvider: commitEvent() requires an open peek state');
      }
      let found = false;
      const list = current.list.map((entry) => {
        if (entry.event.id !== eventId) return entry;
        found = true;
        return {
          ...entry,
          event: {
            ...entry.event,
            ...patch,
          },
        };
      });
      if (!found) {
        throw new Error(`CalendarPeekProvider: commitEvent() could not find event ${eventId}`);
      }
      return { list, index: current.index };
    });
  }, []);

  const value = useMemo<CalendarPeekContextValue>(
    () => ({
      open,
      close,
      next,
      prev,
      commitEvent,
      isOpen: state !== null,
      currentEvent: state ? state.list[state.index].event : null,
      currentList: state ? state.list : [],
      currentIndex: state ? state.index : -1,
      listLength: state ? state.list.length : 0,
    }),
    [open, close, next, prev, commitEvent, state],
  );

  return (
    <CalendarPeekContext.Provider value={value}>{children}</CalendarPeekContext.Provider>
  );
}
