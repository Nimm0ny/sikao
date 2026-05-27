import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useReviewItem } from '../useReviewItem';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useReviewItem', () => {
  it('loads item detail with history and actions', async () => {
    server.use(
      http.get('/api/v2/review/items/101', () =>
        HttpResponse.json({
          item: {
            id: 101,
            kind: 'wrong_answer',
            title: 'Review item',
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
          history: [{ id: 1, outcome: 'incorrect', attemptedAt: '2026-05-21T00:00:00Z', notesJson: {} }],
          actions: [{ key: 'redo', label: '去重做', href: '/q/101/redo', enabled: true }],
          metadata: { sourceKind: 'wrong_answer' },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItem(101), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.item?.id).toBe(101);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.actions).toHaveLength(1);
  });

  it('exposes redo mutation for callers', async () => {
    server.use(
      http.get('/api/v2/review/items/101', () =>
        HttpResponse.json({
          item: {
            id: 101,
            kind: 'wrong_answer',
            title: 'Review item',
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
          history: [],
          actions: [],
          metadata: {},
        }),
      ),
      http.post('/api/v2/review/items/101/redo', () =>
        HttpResponse.json({ ok: true, status: 'started', sessionId: 9001 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItem(101), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.redoMutation.mutateAsync();
    });
    await waitFor(() => expect(result.current.redoMutation.isSuccess).toBe(true));
  });

  it('surfaces detail errors without fallback', async () => {
    server.use(
      http.get('/api/v2/review/items/101', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItem(101), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('stays loading while detail is unresolved', () => {
    server.use(
      http.get('/api/v2/review/items/101', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewItem(101), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
