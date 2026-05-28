/*
 * useCalendarPeek.test.tsx — SIK-138 W6.
 *
 * Why: Requirement 12 + design.md "Peek Card · V1 scope" lock the open /
 *      close / next / prev state machine. This suite exercises the state
 *      transitions and the fail-fast guards on open() so a wiring bug
 *      cannot silently land an empty peek.
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import { CalendarPeekProvider } from './CalendarPeekProvider';
import { useCalendarPeek } from './useCalendarPeek';
import type { CalendarPeekListEntry } from './types';

function makeEvent(id: string, title = `Event ${id}`): PlanEventReadV2 {
  return {
    id,
    title,
    startAt: '2026-05-26T08:00:00+08:00',
    endAt: '2026-05-26T09:00:00+08:00',
    category: 'practice',
    status: 'planned',
    source: 'manual',
    timezone: 'Asia/Shanghai',
    notes: '',
    planId: 1,
    isRecurringInstance: false,
    deletedAt: null,
    linkedSessionId: null,
    parentId: null,
    recurringExceptionDates: [],
    recurringParentId: null,
    recurringRule: null,
    targetId: null,
  } as PlanEventReadV2;
}

function makeList(ids: ReadonlyArray<string>): ReadonlyArray<CalendarPeekListEntry> {
  return ids.map((id) => ({ id, event: makeEvent(id) }));
}

function wrapper({ children }: { readonly children: ReactNode }) {
  return <CalendarPeekProvider>{children}</CalendarPeekProvider>;
}

describe('useCalendarPeek', () => {
  it('throws when called outside a provider', () => {
    expect(() => renderHook(() => useCalendarPeek())).toThrow(
      /must be used inside a <CalendarPeekProvider>/,
    );
  });

  it('starts closed with no current event', () => {
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.currentIndex).toBe(-1);
    expect(result.current.listLength).toBe(0);
  });

  it('opens against the supplied event and list', () => {
    const list = makeList(['a', 'b', 'c']);
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    act(() => {
      result.current.open(list[1].event, list);
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.currentEvent?.id).toBe('b');
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.listLength).toBe(3);
  });

  it('next / prev wrap inside the list scope', () => {
    const list = makeList(['a', 'b', 'c']);
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    act(() => {
      result.current.open(list[2].event, list);
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.currentEvent?.id).toBe('a');
    act(() => {
      result.current.prev();
    });
    expect(result.current.currentEvent?.id).toBe('c');
  });

  it('next / prev are no-ops when the list has a single entry', () => {
    const list = makeList(['only']);
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    act(() => {
      result.current.open(list[0].event, list);
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.currentEvent?.id).toBe('only');
    act(() => {
      result.current.prev();
    });
    expect(result.current.currentEvent?.id).toBe('only');
  });

  it('close() resets to the closed state', () => {
    const list = makeList(['a', 'b']);
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    act(() => {
      result.current.open(list[0].event, list);
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentEvent).toBeNull();
  });

  it('open() throws when the supplied list is empty (fail-fast)', () => {
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    expect(() => {
      act(() => {
        result.current.open(makeEvent('a'), []);
      });
    }).toThrow(/non-empty list/);
  });

  it('open() throws when the event is not present in the list (fail-fast)', () => {
    const list = makeList(['a', 'b']);
    const { result } = renderHook(() => useCalendarPeek(), { wrapper });
    expect(() => {
      act(() => {
        result.current.open(makeEvent('orphan'), list);
      });
    }).toThrow(/not found in supplied list/);
  });
});
