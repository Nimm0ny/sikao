/*
 * ProgressSection tests — SIK-91 Home M-B wave 1 (2026-05-24).
 * 4-state coverage via per-test MSW handler injection.
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
  ],
};

describe('ProgressSection (Home M-B wave 1)', () => {
  it('ready: renders week itemsAnswered + accuracy + weakness list', async () => {
    server.use(http.get('/api/v2/dashboard/progress', () => HttpResponse.json(SAMPLE_OVERVIEW)));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-progress')).toBeInTheDocument());
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('数量关系')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /学习详情/ })).toHaveAttribute('href', '/profile/learning');
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
