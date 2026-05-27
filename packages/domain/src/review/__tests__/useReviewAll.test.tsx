import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useReviewAll } from '../useReviewAll';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useReviewAll', () => {
  it('reuses useReviewItems data and exposes segmentItems', async () => {
    server.use(
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Review item',
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
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewAll({ filters: { status: 'pending' } }), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.segmentItems).toHaveLength(1);
  });

  it('keeps selection helpers available to the list page', async () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewAll(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.toggleSelected(101);
    });
    expect(result.current.selectedIds).toEqual([101]);
  });

  it('stays loading while the list query is unresolved', () => {
    server.use(
      http.get('/api/v2/review/items', async () => {
        await new Promise(() => {});
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewAll(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('surfaces empty list state', async () => {
    server.use(
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewAll(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.segmentItems).toEqual([]);
  });

  it('surfaces list errors', async () => {
    server.use(
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewAll(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
