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
  });
});

describe('CalendarPanel W4 navigation', () => {
  it('renders only week/month tabs and removes the countdown chip', () => {
    usePlanStore.setState({ currentView: 'month', currentDate: '2026-05-30' });
    render(<CalendarPanel />);
    expect(screen.getByRole('tab', { name: '本周' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '本月' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '今日' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-calendar-countdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-month-view')).toBeInTheDocument();
  });

  it('keeps month-mode +/-3-week aria labels', () => {
    usePlanStore.setState({ currentView: 'month', currentDate: '2026-05-30' });
    render(<CalendarPanel />);
    expect(screen.getByRole('button', { name: '上 3 周' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下 3 周' })).toBeInTheDocument();
  });

  it('shifts the month anchor by 21 days on prev/next', async () => {
    const user = userEvent.setup();
    usePlanStore.setState({ currentView: 'month', currentDate: '2026-05-30' });
    render(<CalendarPanel />);
    await user.click(screen.getByRole('button', { name: '上 3 周' }));
    expect(usePlanStore.getState().currentDate).toBe('2026-05-09');
    await user.click(screen.getByRole('button', { name: '下 3 周' }));
    expect(usePlanStore.getState().currentDate).toBe('2026-05-30');
  });

  it('keeps week-mode +/-1-week aria labels', () => {
    usePlanStore.setState({ currentView: 'week', currentDate: '2026-05-30' });
    render(<CalendarPanel />);
    expect(screen.getByRole('button', { name: '上一周' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一周' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-week-view')).toBeInTheDocument();
  });
});
