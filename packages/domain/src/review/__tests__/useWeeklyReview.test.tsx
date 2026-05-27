import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useWeeklyReview } from '../useWeeklyReview';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useWeeklyReview', () => {
  it('combines weekly summary and debt data on success', async () => {
    server.use(
      http.get('/api/v2/review/weekly-summary', () =>
        HttpResponse.json({
          week: '2026-W22',
          itemsReviewed: 12,
          redoAccuracyPct: 75,
          newGraduatedCount: 3,
          newNotesCount: 2,
          generatedNoteId: null,
          nextWeekFocus: '数量关系',
          biggestConcern: null,
          biggestProgress: null,
        }),
      ),
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: true,
          dailyLimit: 20,
          debtSeverity: 'moderate',
          oldestOverdueDays: 8,
          overdueCount: 14,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 12,
          redistributedCount: 3,
        }),
      ),
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({
          buckets: [{ date: '2026-05-28', count: 4 }],
          spreadDays: 1,
          totalCount: 4,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useWeeklyReview(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary?.itemsReviewed).toBe(12);
    expect(result.current.debt.snapshot?.debtSeverity).toBe('moderate');
    expect(result.current.debt.plan?.totalCount).toBe(4);
  });

  it('surfaces empty data correctly', async () => {
    server.use(
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
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: false,
          dailyLimit: 10,
          debtSeverity: 'none',
          oldestOverdueDays: 0,
          overdueCount: 0,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 0,
          redistributedCount: 0,
        }),
      ),
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({ buckets: [], spreadDays: 0, totalCount: 0 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useWeeklyReview(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary?.itemsReviewed).toBe(0);
    expect(result.current.debt.plan?.buckets).toEqual([]);
  });

  it('keeps loading while debt snapshot is unresolved', () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useWeeklyReview(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes debt mutations for UI callers', async () => {
    server.use(
      http.get('/api/v2/review/weekly-summary', () =>
        HttpResponse.json({
          week: '2026-W22',
          itemsReviewed: 1,
          redoAccuracyPct: 100,
          newGraduatedCount: 1,
          newNotesCount: 0,
          generatedNoteId: null,
          nextWeekFocus: null,
          biggestConcern: null,
          biggestProgress: null,
        }),
      ),
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: true,
          dailyLimit: 10,
          debtSeverity: 'light',
          oldestOverdueDays: 2,
          overdueCount: 3,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 3,
          redistributedCount: 0,
        }),
      ),
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({ buckets: [], spreadDays: 0, totalCount: 0 }),
      ),
      http.post('/api/v2/review/debt/redistribute', () =>
        HttpResponse.json({
          canRedistribute: false,
          dailyLimit: 10,
          debtSeverity: 'light',
          oldestOverdueDays: 2,
          overdueCount: 2,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 2,
          redistributedCount: 1,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useWeeklyReview(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.debt.redistributeMutation.mutateAsync();
    });
    await waitFor(() => expect(result.current.debt.redistributeMutation.isSuccess).toBe(true));
  });
});
