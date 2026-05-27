import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import {
  useDashboardTodayReview,
  useRecentPracticeAnswersQuery,
  useReviewItemsQuery,
} from '../reviewQueries';
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

describe('reviewQueries', () => {
  it('useDashboardTodayReview returns queue data', async () => {
    server.use(
      http.get('/api/v2/dashboard/today/review', () =>
        HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Queue item',
              href: '/q/101',
              status: 'pending',
              questionId: 101,
              correctStreak: 0,
              hasCauseAnalysis: false,
              hasUserNotes: false,
              createdAt: '2026-05-20T00:00:00Z',
              updatedAt: '2026-05-20T00:00:00Z',
              nextReviewAt: '2026-05-28T00:00:00Z',
            },
          ],
          total: 1,
        }),
      ),
    );

    const client = makeClient();
    const { result } = renderHook(() => useDashboardTodayReview(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
  });

  it('useReviewItemsQuery forwards filters', async () => {
    server.use(
      http.get('/api/v2/review/items', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [],
          total:
            params.get('status') === 'pending' &&
            params.get('page') === '2' &&
            params.get('page_size') === '50'
              ? 1
              : 0,
          page: Number(params.get('page') ?? '1'),
          pageSize: Number(params.get('page_size') ?? '20'),
        });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(
      () => useReviewItemsQuery({ status: 'pending', page: 2, page_size: 50 }),
      {
        wrapper: wrapper(client),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
    expect(result.current.data?.page).toBe(2);
    expect(result.current.data?.pageSize).toBe(50);
  });

  it('useReviewItemsQuery stays loading for unresolved requests', () => {
    server.use(
      http.get('/api/v2/review/items', async () => {
        await new Promise(() => {});
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useReviewItemsQuery({ status: 'pending' }), {
      wrapper: wrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('useRecentPracticeAnswersQuery forwards include flags and limit', async () => {
    server.use(
      http.get('/api/v2/practice/answers', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [],
          total: Number(params.get('limit') ?? '0'),
          limit: Number(params.get('limit') ?? '0'),
          includeConfidence: params.get('include_confidence'),
          includeDuration: params.get('include_duration'),
        });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(
      () =>
        useRecentPracticeAnswersQuery({
          limit: 10,
          includeConfidence: false,
          includeDuration: false,
        }),
      {
        wrapper: wrapper(client),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.limit).toBe(10);
    expect(result.current.data?.total).toBe(10);
  });
});
