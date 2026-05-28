/*
 * useCalendarViewConfig.test.tsx — SIK-138 W4.
 *
 * Why: Requirement 1 + design.md "State and Data Flow" require one shared
 *      CalendarViewConfig resolver; this suite locks the four observable
 *      transitions:
 *        - profileLoaded=false -> factory default for the view
 *        - profileLoaded=true + empty preferences -> factory default
 *        - profileLoaded=true + valid persisted knobs -> propagated
 *        - profileLoaded=true + malformed knobs -> factory default
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDashboardPreferenceStore } from '@sikao/domain';

import { createDefaultCalendarViewConfig } from './factory';
import { useCalendarViewConfig } from './useCalendarViewConfig';

function setStore(partial: Partial<ReturnType<typeof useDashboardPreferenceStore.getState>>) {
  useDashboardPreferenceStore.setState(partial);
}

afterEach(() => {
  // Reset the singleton store between tests so prior preferences cannot
  // leak into the next assertion.
  setStore({
    preferences: {},
    profileLoaded: false,
    isPersisting: false,
    lastPersistedAt: null,
    lastPersistError: null,
  });
});

describe('useCalendarViewConfig', () => {
  it('returns the factory default while profile data has not loaded', () => {
    setStore({ profileLoaded: false, preferences: { startWeekOnMonday: false, cardLimitPerCell: 7 } });
    const { result } = renderHook(() => useCalendarViewConfig('month'));
    expect(result.current).toEqual(createDefaultCalendarViewConfig('month'));
  });

  it('returns the factory default when profile is loaded but preferences are empty', () => {
    setStore({ profileLoaded: true, preferences: {} });
    const { result } = renderHook(() => useCalendarViewConfig('week'));
    expect(result.current).toEqual(createDefaultCalendarViewConfig('week'));
  });

  it('honors valid persisted startWeekOnMonday and cardLimitPerCell', () => {
    setStore({
      profileLoaded: true,
      preferences: { startWeekOnMonday: false, cardLimitPerCell: 5 },
    });
    const { result } = renderHook(() => useCalendarViewConfig('month'));
    expect(result.current.startWeekOnMonday).toBe(false);
    expect(result.current.cardLimitPerCell).toBe(5);
    // visibleProperties stays at the default preset; W3 forbids persisting it.
    expect(result.current.visibleProperties).toEqual(['title', 'kind', 'status']);
  });

  it('falls back to factory default for malformed persisted values', () => {
    setStore({
      profileLoaded: true,
      preferences: { startWeekOnMonday: 'yes', cardLimitPerCell: 0 },
    });
    const { result } = renderHook(() => useCalendarViewConfig('month'));
    expect(result.current).toEqual(createDefaultCalendarViewConfig('month'));
  });

  it('updates when the underlying preferences change', () => {
    setStore({ profileLoaded: true, preferences: {} });
    const { result, rerender } = renderHook(() => useCalendarViewConfig('month'));
    expect(result.current.cardLimitPerCell).toBe(3);

    act(() => {
      setStore({ profileLoaded: true, preferences: { cardLimitPerCell: 1 } });
    });
    rerender();
    expect(result.current.cardLimitPerCell).toBe(1);
  });
});
