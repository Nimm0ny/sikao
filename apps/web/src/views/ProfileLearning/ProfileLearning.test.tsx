/*
 * ProfileLearning tests — SIK-91 W1 (2026-05-26).
 * Container 4-state coverage + sub-nav / range-bar / KPI row presence.
 *
 * Note on nav baseline: SubNav is in-page Profile navigation (8 pills per
 * sik-fu-b §2.2). It is NOT the global app nav (RootLayout/Rail/BottomTabBar
 * which stays locked at 4 tabs [home, practice, review, note]).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { ProfileLearning } from './ProfileLearning';

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={['/profile/learning']}>
      <QueryClientProvider client={client}>
        <ProfileLearning />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const SAMPLE_OVERVIEW = {
  nearestExamTarget: null,
  subjectAccuracies: [],
  summary: {
    allTime: { accuracy: '0.62', itemsAnswered: 1248, minutesPracticed: 760, sessionsCount: 32 },
    today: { accuracy: '0.7', itemsAnswered: 25, minutesPracticed: 18, sessionsCount: 1 },
    week: { accuracy: '0.66', itemsAnswered: 128, minutesPracticed: 240, sessionsCount: 6 },
    planSlice: {
      eventsDone: 14, eventsInWindowTotal: 28, eventsSkipped: 2,
      minutesPracticedInWindow: 240, minutesTargetInWindow: 480,
      planId: 1, rangeFrom: '2026-05-18', rangeTo: '2026-05-24',
    },
  },
  weaknessTop3: [],
};

describe('ProfileLearning (SIK-91 W1)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ready: renders PageHeader + sub-nav + range-bar + KPI row', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-learning-grid')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '详细学情' })).toBeInTheDocument();
    expect(screen.getByTestId('profile-sub-nav')).toBeInTheDocument();
    expect(screen.getByTestId('profile-learning-range-bar')).toBeInTheDocument();
    expect(screen.getByTestId('profile-learning-kpi-row')).toBeInTheDocument();
    // 5 KPI cells per sik-fu-b §2.4
    expect(screen.getByTestId('kpi-cell-practice')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-cell-duration')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-cell-xingce')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-cell-shenlun')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-cell-streak')).toBeInTheDocument();
  });

  it('sub-nav: 学情 tab has aria-current="page"', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-learning-grid')).toBeInTheDocument());
    const learning = screen.getByRole('link', { name: '学情' });
    expect(learning).toHaveAttribute('aria-current', 'page');
  });

  it('error: surfaces error EmptyState with error message', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json({}, { status: 500 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-learning-error')).toBeInTheDocument());
  });

  it('loading: renders Skeleton stack', async () => {
    server.use(http.get('/api/v2/dashboard/progress', async () => {
      await delay(50);
      return HttpResponse.json(SAMPLE_OVERVIEW);
    }));
    renderWithEnv();
    expect(screen.getByTestId('profile-learning-loading')).toBeInTheDocument();
  });
});
