import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '@sikao/test-utils/server';
import {
  useAdjustmentsPending,
  useCreateEvent,
  useEvent,
  useEvents,
  usePlansList,
} from '@sikao/api-client/plansQueries';

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

describe('home plans queries', () => {
  it('loads the canonical plan list', async () => {
    server.use(
      http.get('/api/v2/plans', () =>
        HttpResponse.json({
          items: [
            {
              id: 11,
              name: 'Sprint plan',
              targetExamId: 'GK-2026',
              targetExamDate: '2026-08-10',
              dailyMinutesTarget: 120,
              style: 'balanced',
              baseline: {},
              focusSubjects: ['xingce'],
              status: 'active',
              source: 'user_manual',
              changeLog: [],
              deletedAt: null,
              archivedAt: null,
              createdAt: '2026-05-22T00:00:00Z',
              updatedAt: '2026-05-22T00:00:00Z',
            },
          ],
          total: 1,
        }),
      ),
    );

    const { result } = renderHook(() => usePlansList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.id).toBe(11);
  });

  it('requests events with include_practice_blocks enabled by default', async () => {
    server.use(
      http.get('/api/v2/plans/events', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('from')).toBe('2026-05-22');
        expect(url.searchParams.get('to')).toBe('2026-05-29');
        expect(url.searchParams.get('include_practice_blocks')).toBe('true');
        return HttpResponse.json({
          data: {
            events: [
              {
                id: '11:2026-05-22',
                planId: 11,
                title: 'Morning drill',
                category: 'xingce',
                notes: '',
                startAt: '2026-05-22T01:00:00.000Z',
                endAt: '2026-05-22T02:00:00.000Z',
                timezone: 'Asia/Shanghai',
                status: 'planned',
                source: 'user_manual',
                parentId: null,
                recurringRule: null,
                recurringParentId: null,
                recurringExceptionDates: [],
                linkedSessionId: null,
                targetId: null,
                deletedAt: null,
                isRecurringInstance: false,
              },
            ],
            practiceBlocks: [],
          },
          meta: {
            from: '2026-05-22',
            to: '2026-05-29',
            includePracticeBlocks: true,
            tz: 'Asia/Shanghai',
          },
        });
      }),
    );

    const { result } = renderHook(
      () =>
        useEvents({
          from: '2026-05-22',
          to: '2026-05-29',
        }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.events).toHaveLength(1);
  });

  it('supports empty pending adjustments', async () => {
    server.use(
      http.get('/api/v2/plans/adjustments', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('status')).toBe('pending');
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    const { result } = renderHook(() => useAdjustmentsPending(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([]);
  });

  it('surfaces query failures for single-event reads', async () => {
    server.use(
      http.get('/api/v2/plans/events/:eventId', () =>
        HttpResponse.json({ detail: 'missing' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useEvent('missing'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('creates events through the canonical endpoint', async () => {
    server.use(
      http.post('/api/v2/plans/events', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.title).toBe('Focused review');
        return HttpResponse.json({
          id: '11:2026-05-23',
          planId: 11,
          title: 'Focused review',
          category: 'review',
          notes: '',
          startAt: '2026-05-23T01:00:00.000Z',
          endAt: '2026-05-23T02:00:00.000Z',
          timezone: 'Asia/Shanghai',
          status: 'planned',
          source: 'user_manual',
          parentId: null,
          recurringRule: null,
          recurringParentId: null,
          recurringExceptionDates: [],
          linkedSessionId: null,
          targetId: null,
          deletedAt: null,
          isRecurringInstance: false,
        });
      }),
    );

    const { result } = renderHook(() => useCreateEvent(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const created = await result.current.mutateAsync({
        planId: 11,
        title: 'Focused review',
        category: 'review',
        notes: '',
        startAt: '2026-05-23T01:00:00.000Z',
        endAt: '2026-05-23T02:00:00.000Z',
        timezone: 'Asia/Shanghai',
        source: 'user_manual',
        recurringRule: null,
        targetId: null,
      });
      expect(created.id).toBe('11:2026-05-23');
    });
  });
});
