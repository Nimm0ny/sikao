import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  useReviewDebtPlan,
  useReviewDebtSnapshot,
  useTriggerReviewDebtRedistribute,
  useWeeklySummary,
} from '../weeklyReviewQueries';
import { server } from './server';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('weeklyReviewQueries', () => {
  it('useWeeklySummary forwards query filters', async () => {
    server.use(
      http.get('/api/v2/review/weekly-summary', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({
          week: params.get('week') ?? '2026-W22',
          itemsReviewed: 12,
          redoAccuracyPct: 75,
          newGraduatedCount: 3,
          newNotesCount: 2,
          generatedNoteId: null,
          nextWeekFocus: '数量关系',
          biggestConcern: null,
          biggestProgress: null,
        });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useWeeklySummary({ week: '2026-W10' }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.week).toBe('2026-W10');
  });

  it('useReviewDebtSnapshot returns debt state', async () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: true,
          dailyLimit: 20,
          debtSeverity: 'moderate',
          oldestOverdueDays: 8,
          overdueCount: 14,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 12,
          redistributedCount: 3,
        }),
      ),
    );

    const client = makeClient();
    const { result } = renderHook(() => useReviewDebtSnapshot(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.debtSeverity).toBe('moderate');
  });

  it('useReviewDebtPlan returns plan buckets', async () => {
    server.use(
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({
          buckets: [{ date: '2026-05-28', count: 4 }],
          spreadDays: 1,
          totalCount: 4,
        }),
      ),
    );

    const client = makeClient();
    const { result } = renderHook(() => useReviewDebtPlan(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.buckets).toHaveLength(1);
  });

  it('useTriggerReviewDebtRedistribute posts the mutation', async () => {
    server.use(
      http.post('/api/v2/review/debt/redistribute', () =>
        HttpResponse.json({
          canRedistribute: false,
          dailyLimit: 20,
          debtSeverity: 'light',
          oldestOverdueDays: 2,
          overdueCount: 3,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 3,
          redistributedCount: 1,
        }),
      ),
    );

    const client = makeClient();
    const { result } = renderHook(() => useTriggerReviewDebtRedistribute(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      const response = await result.current.mutateAsync();
      expect(response.redistributedCount).toBe(1);
    });
  });
});
