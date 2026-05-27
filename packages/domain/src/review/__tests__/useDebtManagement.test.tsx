import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { server } from './server';

import { useDebtManagement } from '../useDebtManagement';

import { createWrapper, makeQueryClient } from './testUtils';

describe('useDebtManagement', () => {
  it('loads debt snapshot and plan on success', async () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: true,
          dailyLimit: 20,
          debtSeverity: 'heavy',
          oldestOverdueDays: 12,
          overdueCount: 18,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 12,
          redistributedCount: 4,
        }),
      ),
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({
          buckets: [{ date: '2026-05-28', count: 5 }],
          spreadDays: 1,
          totalCount: 5,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useDebtManagement(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.snapshot?.debtSeverity).toBe('heavy');
    expect(result.current.plan?.totalCount).toBe(5);
  });

  it('surfaces debt query errors', async () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({ detail: 'forbidden' }, { status: 403 }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useDebtManagement(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('exposes the redistribute mutation', async () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', () =>
        HttpResponse.json({
          canRedistribute: true,
          dailyLimit: 20,
          debtSeverity: 'moderate',
          oldestOverdueDays: 8,
          overdueCount: 10,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 8,
          redistributedCount: 0,
        }),
      ),
      http.get('/api/v2/review/debt/plan', () =>
        HttpResponse.json({ buckets: [], spreadDays: 0, totalCount: 0 }),
      ),
      http.post('/api/v2/review/debt/redistribute', () =>
        HttpResponse.json({
          canRedistribute: false,
          dailyLimit: 20,
          debtSeverity: 'light',
          oldestOverdueDays: 2,
          overdueCount: 3,
          rampupActive: false,
          rampupPhase: null,
          rampupStartedAt: null,
          rampupUnlockAt: null,
          recommendedTodayCount: 3,
          redistributedCount: 7,
        }),
      ),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useDebtManagement(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.redistributeMutation.mutateAsync();
    });
    await waitFor(() => expect(result.current.redistributeMutation.isSuccess).toBe(true));
  });

  it('stays loading while snapshot is unresolved', () => {
    server.use(
      http.get('/api/v2/review/debt/snapshot', async () => {
        await new Promise(() => {});
        return HttpResponse.json({});
      }),
    );

    const client = makeQueryClient();
    const { result } = renderHook(() => useDebtManagement(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
