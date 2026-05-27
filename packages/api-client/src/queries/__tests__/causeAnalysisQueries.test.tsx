import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  useCauseTags,
  useCreateCauseAnalysisGroup,
  usePatchCauseAnalysisDimension,
} from '../causeAnalysisQueries';
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

describe('causeAnalysisQueries', () => {
  it('useCauseTags returns taxonomy items', async () => {
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

    const client = makeClient();
    const { result } = renderHook(() => useCauseTags(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.slug).toBe('concept_confusion');
  });

  it('useCreateCauseAnalysisGroup posts itemIds', async () => {
    server.use(
      http.post('/api/v2/review/cause-analysis/group', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
          analysisId: 601,
          cached: false,
          expiresAt: '2026-05-27T12:00:00Z',
          llmCallId: 902,
          mode: 'group',
          scope: 'group',
          version: 1,
          warningCode: null,
          requestBody: body,
          result: {
            summary: 'group summary',
            mode: 'group',
            dimensions: [],
            suggestedActions: [],
            relatedQuestions: [101, 102],
            evolutionContext: null,
          },
        });
      }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useCreateCauseAnalysisGroup(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      const response = await result.current.mutateAsync({ itemIds: [101, 102] });
      expect(response.analysisId).toBe(601);
    });
  });

  it('usePatchCauseAnalysisDimension succeeds for override payloads', async () => {
    server.use(
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
            summary: 'patched',
            mode: 'single',
            dimensions: [],
            suggestedActions: [],
            relatedQuestions: [101],
            evolutionContext: null,
          },
        }),
      ),
    );

    const client = makeClient();
    const { result } = renderHook(() => usePatchCauseAnalysisDimension(501, 0), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      const response = await result.current.mutateAsync({
        expectedVersion: 1,
        slug: 'formula_misread',
        userSeverity: 'medium',
        userNote: '修正',
      });
      expect(response.version).toBe(2);
    });
  });
});
