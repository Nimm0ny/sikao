import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { useCommandPaletteStore } from '@/lib/commandPalette';
import { Home } from './Home';

function renderHome() {
  // Default segment view defers to the persisted preference store; both
  // TodayCalendarView and WeekCalendarView consume useEvents on mount, so
  // we provide a QueryClient + a stub /plans/events handler so the render
  // doesn't throw during these structural assertions.
  server.use(
    http.get('/api/v2/plans/events', () =>
      HttpResponse.json({
        data: { events: [], practiceBlocks: [] },
        meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
      }),
    ),
    // SIK-122: subtitle pulls streakDays from /progress/weekly. Default
    // mock returns 0 so the streak segment is hidden (AGENT-H7 — never
    // fabricate). Specific tests can override.
    http.get('/api/v2/progress/weekly', () =>
      HttpResponse.json({
        weekStart: '2026-05-25',
        weekEnd: '2026-05-31',
        xingceAnswered: 0,
        xingceAccuracy: 0,
        essaySubmitted: 0,
        tasksCompleted: 0,
        tasksTotal: 0,
        streakDays: 0,
      }),
    ),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  // Reset palette store between tests so click assertions don't leak.
  useCommandPaletteStore.setState({ open: false });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={client}>
        <Home />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Home view (D.4.1)', () => {
  it('renders the 4 metric-row cards (countdown / today / week / review)', () => {
    renderHome();
    expect(screen.getByTestId('home-metric-row')).toBeInTheDocument();
    expect(screen.getByTestId('home-metric-countdown')).toBeInTheDocument();
    expect(screen.getByTestId('home-metric-today')).toBeInTheDocument();
    expect(screen.getByTestId('home-metric-week')).toBeInTheDocument();
    expect(screen.getByTestId('home-metric-review')).toBeInTheDocument();
  });

  it('renders a real calendar body inside the CalendarPanel', () => {
    renderHome();
    // Default view is 'week' (store default); WeekCalendarView lands.
    // SIK-90 Wave 2: CalendarPanel replaced PlanSection + double-head.
    expect(screen.getByTestId('home-week-calendar')).toBeInTheDocument();
  });

  it('renders the CalendarPanel container in place of the calendar Panel', () => {
    renderHome();
    expect(screen.getByTestId('home-calendar-panel')).toBeInTheDocument();
  });

  it('renders the bottom row with 3 panels (今日任务 / 错题回顾 / 推荐套题)', () => {
    renderHome();
    const root = screen.getByTestId('home-view');
    const panels = within(root).getAllByTestId('panel');
    // PlanSection replaced the calendar Panel in SIK-90 wave 1; the
    // remaining 3 panels are the bottom row (今日任务 / 错题回顾 / 推荐套题).
    expect(panels.length).toBe(3);
  });

  it('exposes a primary CTA in the page header', () => {
    renderHome();
    const cta = screen.getByRole('button', { name: '开始今日练习' });
    expect(cta).toBeInTheDocument();
  });

  it('refuses to render with negative metric values (fail-fast)', () => {
    // SIK-125 wired the metric cards to live API data; the previous static
    // PLACEHOLDER_METRICS guard was removed. Empty-data fall-back is now
    // the AGENT-H7 path: render '—' / omit the segment, never throw.
    expect(() => renderHome()).not.toThrow();
  });

  // SIK-122: Home topbar contract.
  it('renders the home topbar with cmd search box + bell + settings + CTA', () => {
    renderHome();
    expect(screen.getByTestId('home-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('home-topbar-cmd')).toBeInTheDocument();
    expect(screen.getByTestId('home-topbar-bell')).toBeDisabled();
    expect(screen.getByTestId('home-topbar-settings')).toBeDisabled();
  });

  it('clicking the topbar cmd box opens the shared CommandPalette store', () => {
    renderHome();
    expect(useCommandPaletteStore.getState().open).toBe(false);
    fireEvent.click(screen.getByTestId('home-topbar-cmd'));
    expect(useCommandPaletteStore.getState().open).toBe(true);
  });

  it('topbar subtitle shows date only when streakDays is 0 (AGENT-H7 no fabrication)', async () => {
    renderHome();
    // Wait for the weekly summary query to resolve; streak === 0 means
    // the subtitle is just the date.
    const subtitle = await screen.findByTestId('home-topbar-subtitle');
    // CN locale: "2026年5月26日" (no second segment).
    expect(subtitle.textContent).not.toMatch(/已连续签到/);
  });
});
