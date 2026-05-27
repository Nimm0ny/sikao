import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useReviewToday } from '../useReviewToday';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useReviewToday', () => {
  it('combines queue, weekly summary, and smart cards on success', async () => {
    server.use(
      http.get('/api/v2/dashboard/today/review', () =>
        HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Queue item',
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
          total: 1,
        }),
      ),
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Queue item',
              href: '/q/101?ctx=review&review_id=101',
              status: 'pending',
              questionId: 101,
              correctStreak: 0,
              hasCauseAnalysis: false,
              hasUserNotes: false,
              createdAt: '2026-05-20T00:00:00Z',
              updatedAt: '2026-05-20T00:00:00Z',
              nextReviewAt: '2026-05-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
      http.get('/api/v2/review/weekly-summary', () =>
        HttpResponse.json({
          week: '2026-W22',
          itemsReviewed: 10,
          redoAccuracyPct: 80,
          newGraduatedCount: 2,
          newNotesCount: 1,
          generatedNoteId: null,
          nextWeekFocus: '数量关系',
          biggestConcern: null,
          biggestProgress: null,
        }),
      ),
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({
          items: [
            {
              questionId: 101,
              sessionId: 7001,
              isCorrect: false,
              answeredAt: '2026-05-26T08:00:00Z',
              confidence: null,
              durationSeconds: 42,
            },
            {
              questionId: 101,
              sessionId: 7002,
              isCorrect: false,
              answeredAt: '2026-05-25T08:00:00Z',
              confidence: null,
              durationSeconds: 35,
            },
          ],
          total: 2,
          limit: 200,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewToday(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queueItems).toHaveLength(1);
    expect(result.current.weeklySummaryQuery.data?.itemsReviewed).toBe(10);
    expect(result.current.smartCards.cards[0]?.type).toBe('high_frequency_wrong');
  });

  it('returns empty smart cards when dependent lists are empty', async () => {
    server.use(
      http.get('/api/v2/dashboard/today/review', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('/api/v2/review/items', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
      http.get('/api/v2/review/weekly-summary', () =>
        HttpResponse.json({
          week: '2026-W22',
          itemsReviewed: 0,
          redoAccuracyPct: 0,
          newGraduatedCount: 0,
          newNotesCount: 0,
          generatedNoteId: null,
          nextWeekFocus: null,
          biggestConcern: null,
          biggestProgress: null,
        }),
      ),
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewToday(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.smartCards.cards).toEqual([]);
  });

  it('aggregates smart-card inputs across multiple review-item pages', async () => {
    const requestedPages: string[] = [];
    server.use(
      http.get('/api/v2/dashboard/today/review', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('/api/v2/review/items', ({ request }) => {
        const params = new URL(request.url).searchParams;
        const page = params.get('page') ?? '1';
        requestedPages.push(`${page}:${params.get('page_size') ?? 'missing'}`);
        if (page === '1') {
          return HttpResponse.json({
            items: Array.from({ length: 100 }, (_, index) => ({
              id: index + 1,
              kind: 'wrong_answer',
              title: `Review item ${index + 1}`,
              href: `/q/${index + 1}?ctx=review&review_id=${index + 1}`,
              status: 'pending',
              questionId: index + 1,
              correctStreak: 0,
              hasCauseAnalysis: false,
              hasUserNotes: false,
              createdAt: '2026-05-20T00:00:00Z',
              updatedAt: '2026-05-20T00:00:00Z',
              nextReviewAt: '2026-05-28T00:00:00Z',
            })),
            total: 101,
            page: 1,
            pageSize: 100,
          });
        }
        return HttpResponse.json({
          items: [
            {
              id: 101,
              kind: 'wrong_answer',
              title: 'Review item 101',
              href: '/q/101?ctx=review&review_id=101',
              status: 'pending',
              questionId: 101,
              correctStreak: 0,
              hasCauseAnalysis: false,
              hasUserNotes: false,
              createdAt: '2026-05-20T00:00:00Z',
              updatedAt: '2026-05-20T00:00:00Z',
              nextReviewAt: '2026-05-01T00:00:00Z',
            },
          ],
          total: 101,
          page: 2,
          pageSize: 100,
        });
      }),
      http.get('/api/v2/review/weekly-summary', () =>
        HttpResponse.json({
          week: '2026-W22',
          itemsReviewed: 0,
          redoAccuracyPct: 0,
          newGraduatedCount: 0,
          newNotesCount: 0,
          generatedNoteId: null,
          nextWeekFocus: null,
          biggestConcern: null,
          biggestProgress: null,
        }),
      ),
      http.get('/api/v2/practice/answers', () =>
        HttpResponse.json({
          items: [
            {
              questionId: 101,
              sessionId: 7001,
              isCorrect: false,
              answeredAt: '2026-05-26T08:00:00Z',
              confidence: null,
              durationSeconds: 42,
            },
            {
              questionId: 101,
              sessionId: 7002,
              isCorrect: false,
              answeredAt: '2026-05-25T08:00:00Z',
              confidence: null,
              durationSeconds: 35,
            },
          ],
          total: 2,
          limit: 200,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewToday(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(requestedPages).toEqual(['1:100', '2:100']);
    expect(result.current.reviewItemsQuery.data?.items).toHaveLength(101);
    expect(result.current.smartCards.cards[0]?.questionIds).toEqual([101]);
  });

  it('stays loading while a dependent request is unresolved', () => {
    server.use(
      http.get('/api/v2/dashboard/today/review', async () => {
        await new Promise(() => {});
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewToday(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('surfaces errors from any dependent query', async () => {
    server.use(
      http.get('/api/v2/dashboard/today/review', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useReviewToday(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
