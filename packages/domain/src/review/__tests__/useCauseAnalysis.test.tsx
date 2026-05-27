import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useCauseAnalysis } from '../useCauseAnalysis';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useCauseAnalysis', () => {
  it('loads cause tags and stores the latest analysis after running', async () => {
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
      http.post('/api/v2/review/items/101/cause-analysis', () =>
        HttpResponse.json({
          analysisId: 501,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 901,
          mode: 'single',
          scope: 'single',
          version: 1,
          warningCode: null,
          result: {
            summary: '主要问题在概念混淆。',
            mode: 'single',
            dimensions: [
              {
                slug: 'concept_confusion',
                nameDisplay: '概念混淆',
                severity: 'high',
                suggestion: '回看概念定义。',
                userOverride: null,
              },
            ],
            suggestedActions: ['回看概念定义'],
            relatedQuestions: [101],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useCauseAnalysis(101), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.tagsQuery.isSuccess).toBe(true));
    await act(async () => {
      await result.current.runAnalysis({ mode: 'single' });
    });

    expect(result.current.analysis?.analysisId).toBe(501);
    expect(result.current.analysis?.result.summary).toContain('概念混淆');
  });

  it('updates cached analysis after a dimension override', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/items/101/cause-analysis', () =>
        HttpResponse.json({
          analysisId: 501,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 901,
          mode: 'single',
          scope: 'single',
          version: 1,
          warningCode: null,
          result: {
            summary: 'before override',
            mode: 'single',
            dimensions: [
              {
                slug: 'concept_confusion',
                nameDisplay: '概念混淆',
                severity: 'high',
                suggestion: '回看概念定义。',
                userOverride: null,
              },
            ],
            suggestedActions: [],
            relatedQuestions: [],
            evolutionContext: null,
          },
        }),
      ),
      http.patch('/api/v2/review/cause-analysis/501/dimensions/0', () =>
        HttpResponse.json({
          analysisId: 501,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 901,
          mode: 'single',
          scope: 'single',
          version: 2,
          warningCode: null,
          result: {
            summary: 'after override',
            mode: 'single',
            dimensions: [
              {
                slug: 'formula_misread',
                nameDisplay: '公式记错',
                severity: 'medium',
                suggestion: '复习公式。',
                userOverride: {
                  slug: 'formula_misread',
                  nameDisplay: '公式记错',
                  userSeverity: 'medium',
                  userNote: '用户修正',
                },
              },
            ],
            suggestedActions: [],
            relatedQuestions: [],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useCauseAnalysis(101), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.runAnalysis({ mode: 'single' });
    });
    await act(async () => {
      await result.current.overrideMutation.mutateAsync({
        analysisId: 501,
        dimensionIndex: 0,
        payload: {
          expectedVersion: 1,
          slug: 'formula_misread',
          userSeverity: 'medium',
          userNote: '用户修正',
        },
      });
    });
    await waitFor(() => expect(result.current.analysis?.version).toBe(2));
    expect(result.current.analysis?.result.summary).toContain('after override');
  });

  it('surfaces analysis errors without fallback', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/items/101/cause-analysis', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useCauseAnalysis(101), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.runAnalysis({ mode: 'single' })).rejects.toBeTruthy();
    });
  });

  it('clears the cached analysis state', async () => {
    server.use(
      http.get('/api/v2/review/cause-tags', () => HttpResponse.json({ items: [], total: 0 })),
      http.post('/api/v2/review/items/101/cause-analysis', () =>
        HttpResponse.json({
          analysisId: 501,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 901,
          mode: 'single',
          scope: 'single',
          version: 1,
          warningCode: null,
          result: {
            summary: '主要问题在概念混淆。',
            mode: 'single',
            dimensions: [],
            suggestedActions: [],
            relatedQuestions: [],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useCauseAnalysis(101), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.runAnalysis({ mode: 'single' });
    });
    act(() => {
      result.current.clearAnalysis();
    });
    expect(result.current.analysis).toBeNull();
  });
});
