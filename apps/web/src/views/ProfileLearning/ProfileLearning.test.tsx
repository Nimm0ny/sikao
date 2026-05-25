/*
 * ProfileLearning tests — SIK-91 Home M-B wave 2 (2026-05-24).
 * Container 4-state coverage + plan slice rendering.
 */
import { describe, it, expect } from 'vitest';
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

describe('ProfileLearning (Home M-B wave 2)', () => {
  it('ready: renders Header summary + PlanSlice progressbar', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-learning')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '学习详情' })).toBeInTheDocument();
    expect(screen.getByText(/累计练习 1248 题/)).toBeInTheDocument();
    expect(screen.getByTestId('profile-learning-plan-slice')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    // 14 / 28 = 50%
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
  });

  it('error: surfaces ErrorCard with error message', async () => {
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
    await waitFor(() => expect(screen.queryByTestId('profile-learning-loading')).not.toBeInTheDocument());
  });

  it('AGENT-H7: zero-target plan slice renders 0% (no division-by-zero)', async () => {
    const zeroTargetOverview = {
      ...SAMPLE_OVERVIEW,
      summary: {
        ...SAMPLE_OVERVIEW.summary,
        planSlice: {
          ...SAMPLE_OVERVIEW.summary.planSlice,
          eventsInWindowTotal: 0,
          eventsDone: 0,
        },
      },
    };
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(zeroTargetOverview)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-learning')).toBeInTheDocument());
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
  });
});
