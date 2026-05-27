import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useReviewItems } from '../useReviewItems';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useReviewItems', () => {
  it('loads review items with the supplied filters', async () => {
    server.use(
      http.get('/api/v2/review/items', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Filtered review item',
              href: '/q/101?ctx=review&review_id=101',
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
          total: params.get('status') === 'pending' ? 1 : 0,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(
      () => useReviewItems({ initialFilters: { status: 'pending' } }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.filters).toEqual({ status: 'pending' });
  });

  it('toggles and clears selected ids', async () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItems(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.toggleSelected(101);
      result.current.toggleSelected(102);
    });
    expect(result.current.selectedIds).toEqual([101, 102]);

    act(() => {
      result.current.toggleSelected(101);
    });
    expect(result.current.selectedIds).toEqual([102]);

    act(() => {
      result.current.clearSelected();
    });
    expect(result.current.selectedIds).toEqual([]);
  });

  it('stays loading while the list query is unresolved', () => {
    server.use(
      http.get('/api/v2/review/items', async () => {
        await new Promise(() => {});
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItems(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('clears selected ids after a successful batch action', async () => {
    server.use(
      http.post('/api/v2/review/items/batch', () =>
        HttpResponse.json({ successCount: 1, failureCount: 0, errors: [] }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItems(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.replaceSelected([101, 102]);
    });
    await act(async () => {
      await result.current.runBatchAction({ action: 'archive', itemIds: [101, 102] });
    });
    expect(result.current.selectedIds).toEqual([]);
  });

  it('surfaces list errors without fallback data', async () => {
    server.use(
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItems(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
