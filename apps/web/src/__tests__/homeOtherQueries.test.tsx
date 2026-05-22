import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '@sikao/test-utils/server';
import { useDashboardToday } from '@sikao/api-client/dashboardQueries';
import { useProfileRecords, useUpdateProfileInfo } from '@sikao/api-client/profileQueries';
import { useProgressOverview } from '@sikao/api-client/progressQueries';
import {
  useRecommendationsToday,
  useRefreshRecommendations,
} from '@sikao/api-client/recommendationsQueries';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  server.resetHandlers();
});

describe('home runtime query modules', () => {
  it('loads empty recommendations from the canonical endpoint', async () => {
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({
          items: [],
          total: 0,
        }),
      ),
    );

    const { result } = renderHook(() => useRecommendationsToday(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(0);
  });

  it('injects Idempotency-Key when refreshing recommendations', async () => {
    server.use(
      http.post('/api/v2/recommendations/refresh', ({ request }) => {
        expect(request.headers.get('Idempotency-Key')).toMatch(
          /^[0-9a-f-]{36}$/i,
        );
        return HttpResponse.json({
          items: [
            {
              id: 9,
              title: 'Today sprint',
              reason: 'Weakness spike',
              estimatedMinutes: 45,
              cta: 'Start session',
              actionType: 'session',
              payload: {},
              generatedAt: '2026-05-22T00:00:00Z',
              expiresAt: '2026-05-22T23:00:00Z',
              servedCount: 1,
              status: 'pending',
              acceptedAt: null,
              rejectedAt: null,
              sourceSignals: {},
              llmCallId: 101,
            },
          ],
          total: 1,
        });
      }),
    );

    const { result } = renderHook(() => useRefreshRecommendations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const refreshed = await result.current.mutateAsync({
        payload: { trigger: 'manual' },
      });
      expect(refreshed.items[0]?.id).toBe(9);
    });
  });

  it('loads dashboard today through /api/v2/dashboard/today', async () => {
    server.use(
      http.get('/api/v2/dashboard/today', () =>
        HttpResponse.json({
          date: '2026-05-22',
          planId: 11,
          summary: {
            totalEvents: 3,
            plannedCount: 2,
            inProgressCount: 1,
            doneCount: 0,
            skippedCount: 0,
            eventMinutesTotal: 150,
            practiceMinutesTotal: 0,
            completionRate: '0.00',
          },
          events: [],
          practiceBlocks: [],
          nearestExamTarget: null,
        }),
      ),
    );

    const { result } = renderHook(() => useDashboardToday(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.planId).toBe(11);
  });

  it('loads progress overview through the canonical dashboard progress route', async () => {
    server.use(
      http.get('/api/v2/dashboard/progress', () =>
        HttpResponse.json({
          summary: {
            today: {
              minutesPracticed: 40,
              itemsAnswered: 12,
              accuracy: '0.75',
              sessionsCount: 1,
            },
            week: {
              minutesPracticed: 180,
              itemsAnswered: 60,
              accuracy: '0.72',
              sessionsCount: 4,
            },
            allTime: {
              minutesPracticed: 900,
              itemsAnswered: 320,
              accuracy: '0.71',
              sessionsCount: 22,
            },
            planSlice: {
              planId: 11,
              rangeFrom: '2026-05-19',
              rangeTo: '2026-05-25',
              eventsInWindowTotal: 8,
              eventsDone: 2,
              eventsSkipped: 0,
              minutesTargetInWindow: 600,
              minutesPracticedInWindow: 180,
            },
          },
          weaknessTop3: [],
          subjectAccuracies: [],
          nearestExamTarget: null,
        }),
      ),
    );

    const { result } = renderHook(() => useProgressOverview(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.summary.today.itemsAnswered).toBe(12);
  });

  it('reads profile records from /api/v2/profile/records', async () => {
    server.use(
      http.get('/api/v2/profile/records', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('session_id')).toBe('42');
        return HttpResponse.json({
          items: [
            {
              id: 'record-42',
              kind: 'practice_session',
              title: 'Morning drill',
              status: 'done',
              score: '72.50',
              occurredAt: '2026-05-22T01:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const { result } = renderHook(
      () =>
        useProfileRecords({
          sessionId: 42,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.id).toBe('record-42');
  });

  it('updates profile info through the canonical profile module', async () => {
    server.use(
      http.put('/api/v2/profile/info', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.dashboardPreferences).toEqual({ focusMode: 'deep' });
        return HttpResponse.json({
          displayName: 'Tester',
          realName: null,
          region: null,
          bio: null,
          aiAdjustEnabled: true,
          dashboardPreferences: { focusMode: 'deep' },
          recommenderPreferences: {},
        });
      }),
    );

    const { result } = renderHook(() => useUpdateProfileInfo(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const updated = await result.current.mutateAsync({
        dashboardPreferences: { focusMode: 'deep' },
      });
      expect(updated.dashboardPreferences).toEqual({ focusMode: 'deep' });
    });
  });
});
