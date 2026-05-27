/*
 * ProgressSection tests — SIK-91 W1 (2026-05-26).
 * 4-state coverage via per-test MSW handler injection. Visual contract
 * sik-fu-d §2.1: bc-head + 3 weak-item rows (name + bar + val); no Badge,
 * no week-itemsAnswered metric — those were SIK-91 v1 drift.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../mocks/server';
import { ProgressSection } from './ProgressSection';

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={client}>
        <ProgressSection />
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
      planId: 1, rangeFrom: null, rangeTo: null,
    },
  },
  weaknessTop3: [
    { subjectKey: 'shuliang', subjectLabel: '数量关系', accuracy: '0.42', answered: 120, correct: 50, severity: 'high', trend: 'down' },
    { subjectKey: 'panduan', subjectLabel: '判断推理', accuracy: '0.55', answered: 80, correct: 44, severity: 'medium', trend: 'flat' },
    { subjectKey: 'ziliao', subjectLabel: '资料分析', accuracy: '0.62', answered: 90, correct: 56, severity: 'medium', trend: 'flat' },
  ],
};

describe('ProgressSection (SIK-91 W1)', () => {
  it('ready: renders Top 3 弱项 head + weak items + 弱项分析 link', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-progress')).toBeInTheDocument());
    expect(screen.getByText('Top 3 弱项')).toBeInTheDocument();
    expect(screen.getByText('数量关系')).toBeInTheDocument();
    expect(screen.getByText('判断推理')).toBeInTheDocument();
    expect(screen.getByText('资料分析')).toBeInTheDocument();
    // Link points to /profile/learning with range query (active 30d)
    const link = screen.getByRole('link', { name: /弱项分析/ });
    expect(link).toHaveAttribute('href', '/profile/learning?range=30d');
  });

  it('ready: marks <=50% accuracy as err on the bar fill', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-progress-weak-shuliang')).toBeInTheDocument());
    const row = screen.getByTestId('home-progress-weak-shuliang');
    // 数量关系 is 42% -> err class on the inner bar fill
    const fill = row.querySelector('[data-err="true"]');
    expect(fill).not.toBeNull();
  });

  it('error: renders EmptyState on 500', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json({}, { status: 500 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-progress-error')).toBeInTheDocument());
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/dashboard/progress', async () => {
      await delay(50);
      return HttpResponse.json(SAMPLE_OVERVIEW);
    }));
    renderWithEnv();
    expect(screen.getByTestId('home-progress-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-progress-loading')).not.toBeInTheDocument());
  });
});
