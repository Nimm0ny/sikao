import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDashboardPreferenceStore, usePlanStore } from '@sikao/domain';

import { CalendarPanel } from './CalendarPanel';

vi.mock('./WeekCalendarView', () => ({
  WeekCalendarView: () => <div data-testid="mock-week-view" />,
}));

vi.mock('./MonthCalendarView', () => ({
  MonthCalendarView: () => <div data-testid="mock-month-view" />,
}));

vi.mock('./calendarViewConfig', async () => {
  const actual = await vi.importActual<typeof import('./calendarViewConfig')>('./calendarViewConfig');
  return {
    ...actual,
    useCalendarViewConfig: () => ({
      view: 'month',
      startWeekOnMonday: true,
      cardLimitPerCell: 3,
      dateField: 'startAt' as const,
      visibleProperties: ['title', 'kind', 'status'] as const,
    }),
  };
});

const defaultPatchPreferences = useDashboardPreferenceStore.getState().patchPreferences;

afterEach(() => {
  usePlanStore.setState({
    currentPlanId: null,
    currentView: 'week',
    currentDate: '2026-05-30',
    selectedRange: null,
    optimisticEvents: new Map(),
  });
  useDashboardPreferenceStore.setState({
    preferences: {},
    profileLoaded: false,
    isPersisting: false,
    lastPersistedAt: null,
    lastPersistError: null,
    patchPreferences: defaultPatchPreferences,
  });
});

describe('CalendarPanel W4 navigation', () => {
  it('renders only the week/month tabs and removes the countdown chip', () => {
    usePlanStore.setState({ currentView: 'month', currentDate: '2026-05-30' });
    render(<CalendarPanel />);

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByTestId('home-calendar-countdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-month-view')).toBeInTheDocument();
  });

  it('shifts the month anchor by 21 days on prev/next', async () => {
    const user = userEvent.setup();
    usePlanStore.setState({ currentView: 'month', currentDate: '2026-05-30' });
    render(<CalendarPanel />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(usePlanStore.getState().currentDate).toBe('2026-05-09');
    await user.click(buttons[2]);
    expect(usePlanStore.getState().currentDate).toBe('2026-05-30');
  });

  it('keeps the week view mounted when currentView=week', () => {
    usePlanStore.setState({ currentView: 'week', currentDate: '2026-05-30' });
    render(<CalendarPanel />);

    expect(screen.getByTestId('mock-week-view')).toBeInTheDocument();
  });

  it('persists tab changes through the calendar preference patch builders', async () => {
    const user = userEvent.setup();
    const patchPreferences = vi.fn().mockResolvedValue(undefined);
    usePlanStore.setState({ currentView: 'week', currentDate: '2026-05-30' });
    useDashboardPreferenceStore.setState({
      preferences: {},
      profileLoaded: true,
      patchPreferences,
    });

    render(<CalendarPanel />);
    await user.click(screen.getAllByRole('tab')[1]);

    expect(usePlanStore.getState().currentView).toBe('month');
    expect(patchPreferences).toHaveBeenCalledWith({ homeCalendarView: 'month' });
  });
});
