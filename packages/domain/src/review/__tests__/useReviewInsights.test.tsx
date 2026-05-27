import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useReviewInsights } from '../useReviewInsights';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useReviewInsights', () => {
  it('combines the three insights queries on success', async () => {
    server.use(
      http.get('/api/v2/review/insights/trends', () =>
        HttpResponse.json({ days: [{ date: '2026-05-24', newIncorrect: 1, graduated: 2, netAccumulation: -1 }] }),
      ),
      http.get('/api/v2/review/insights/causes', () =>
        HttpResponse.json({ causes: [{ slug: 'concept_confusion', name: '概念混淆', count: 3, severityDistribution: { high: 2 } }] }),
      ),
      http.get('/api/v2/review/insights/redo-accuracy', () =>
        HttpResponse.json({ weeks: [{ week: '2026-W22', accuracyPct: 75, correctCount: 9, totalAttempts: 12 }] }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewInsights(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.trendsQuery.data?.days).toHaveLength(1);
    expect(result.current.causesQuery.data?.causes).toHaveLength(1);
    expect(result.current.redoAccuracyQuery.data?.weeks).toHaveLength(1);
  });

  it('surfaces an error from any dependent insights query', async () => {
    server.use(
      http.get('/api/v2/review/insights/trends', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewInsights(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('handles empty insights payloads', async () => {
    server.use(
      http.get('/api/v2/review/insights/trends', () => HttpResponse.json({ days: [] })),
      http.get('/api/v2/review/insights/causes', () => HttpResponse.json({ causes: [] })),
      http.get('/api/v2/review/insights/redo-accuracy', () => HttpResponse.json({ weeks: [] })),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewInsights(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.trendsQuery.data?.days).toEqual([]);
    expect(result.current.causesQuery.data?.causes).toEqual([]);
    expect(result.current.redoAccuracyQuery.data?.weeks).toEqual([]);
  });

  it('stays loading while one insight query is unresolved', () => {
    server.use(
      http.get('/api/v2/review/insights/trends', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewInsights(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
