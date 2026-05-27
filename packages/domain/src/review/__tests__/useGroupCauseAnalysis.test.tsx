import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useGroupCauseAnalysis } from '../useGroupCauseAnalysis';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useGroupCauseAnalysis', () => {
  it('loads cause tags through the shared taxonomy query', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              slug: 'concept_confusion',
              name: '概念混淆',
              description: '概念理解不稳。',
              category: 'cognition',
              severityDefault: 'high',
              taxonomyVersion: 'v1',
              displayOrder: 1,
              isActive: true,
            },
          ],
          total: 1,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupCauseAnalysis(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.tagsQuery.isSuccess).toBe(true));
    expect(result.current.tagsQuery.data?.items[0]?.slug).toBe('concept_confusion');
  });

  it('exposes loading state while the taxonomy query is unresolved', () => {
    server.use(
      http.get('/api/v2/review/cause-tags', async () => {
        await new Promise(() => {});
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupCauseAnalysis(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.tagsQuery.isLoading).toBe(true);
  });

  it('stores group analysis and signature after running', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/cause-analysis/group', () =>
        HttpResponse.json({
          analysisId: 601,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 902,
          mode: 'group',
          scope: 'group',
          version: 1,
          warningCode: null,
          result: {
            summary: 'group summary',
            mode: 'group',
            dimensions: [],
            suggestedActions: [],
            relatedQuestions: [101, 102],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupCauseAnalysis(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.runGroupAnalysis({ itemIds: [102, 101] });
    });

    expect(result.current.analysis?.analysisId).toBe(601);
    expect(result.current.signature).toBe('group:101,102');
  });

  it('surfaces group analysis errors without fallback', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/cause-analysis/group', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupCauseAnalysis(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.runGroupAnalysis({ itemIds: [101, 102] })).rejects.toBeTruthy();
    });
  });

  it('clears analysis state and signature', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/cause-analysis/group', () =>
        HttpResponse.json({
          analysisId: 601,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 902,
          mode: 'group',
          scope: 'group',
          version: 1,
          warningCode: null,
          result: {
            summary: 'group summary',
            mode: 'group',
            dimensions: [],
            suggestedActions: [],
            relatedQuestions: [101, 102],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupCauseAnalysis(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.runGroupAnalysis({ itemIds: [101, 102] });
    });
    act(() => {
      result.current.clearAnalysis();
    });
    expect(result.current.analysis).toBeNull();
    expect(result.current.signature).toBeNull();
  });
});
