import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useRecentAnswers } from '../useRecentAnswers';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useRecentAnswers', () => {
  it('maps durationSeconds into durationS on success', async () => {
    server.use(
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({
          items: [
            {
              questionId: 101,
              sessionId: 7001,
              isCorrect: false,
              answeredAt: '2026-05-26T08:00:00Z',
              confidence: 'likely',
              durationSeconds: 42,
            },
          ],
          total: 1,
          limit: 200,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useRecentAnswers(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items[0]).toMatchObject({
      questionId: 101,
      confidence: 'likely',
      durationS: 42,
    });
  });

  it('returns an empty list when the feed is empty', async () => {
    server.use(
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useRecentAnswers(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('surfaces request errors without silent fallback', async () => {
    server.use(
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useRecentAnswers(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('forwards limit and include flags to the query layer', async () => {
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

    const client = makeQueryClient();
    const { result } = renderHook(
      () => useRecentAnswers({ limit: 10, includeConfidence: false, includeDuration: false }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.limit).toBe(10);
    expect(result.current.total).toBe(10);
  });
});
