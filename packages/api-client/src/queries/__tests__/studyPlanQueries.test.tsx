/**
 * Slice 3b · studyPlanQueries hooks 测试 (plan §7 第 1-3 条).
 *
 * 覆盖:
 * 1. useStudyPlanToday 拉 GET /today 解析三种 generationStatus
 * 2. usePatchStudyTask 乐观更新 + onError rollback 强 assert (queryClient
 *    getQueryData 拿到的 task.status 真回到 'pending')
 * 3. useStartStudyPlanSession 三种 task_kind payload 构造 (essay 不打端点 /
 *    practice 带 paperCode+questionIds / review_wrong 仅 questionIds)
 *
 * Slice 3c (commit 1 +3 vitest):
 * 4. useStudyPlanHistory 首页解析 nextCursor + items
 * 5. fetchNextPage 拼到 pages[1] + cursor 透传到 BE
 * 6. 401 不 retry (跟 today 一致, 共享 shouldRetry)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@sikao/test-utils/server';
import { api } from './request';
import {
  fetchStudyPlanHistory,
  fetchStudyPlanToday,
  studyPlanKeys,
  useStudyPlanDetail,
  useStudyPlanHistory,
  useStudyPlanToday,
  usePatchStudyTask,
  useStartStudyPlanSession,
} from '../studyPlanQueries';
import type {
  StudyPlanHistoryListV2,
  StudyPlanResponse,
} from './types/study-plan';

function makeClient() {
  // gcTime 60s (而非 0): 测 mutation onSettled invalidate 后 cache 仍能查
  // (gcTime 0 会让无 observer 的 query 立即 GC → getQueryData 拿 undefined).
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 60_000, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function buildPlan(
  generationStatus: StudyPlanResponse['generationStatus'],
): StudyPlanResponse {
  return {
    id: 1,
    planDate: '2026-04-30',
    generationStatus,
    createdAt: '2026-04-30T00:00:00Z',
    tasks: [
      {
        id: 10,
        taskKind: 'practice',
        status: 'pending',
        displayOrder: 0,
        completedAt: null,
        createdAt: '2026-04-30T00:00:00Z',
        payload: {
          paperCode: 'D1',
          questionIds: [1],
          title: '今日 1 题',
          subtitle: null,
        },
      },
    ],
  };
}

let client: QueryClient;
beforeEach(() => {
  client = makeClient();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStudyPlanToday', () => {
  it.each([
    ['success' as const],
    ['fallback_cold_start' as const],
    ['fallback_llm_failed' as const],
  ])('解析 generationStatus=%s', async (status) => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json(buildPlan(status)),
      ),
    );
    const { result } = renderHook(() => useStudyPlanToday(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.generationStatus).toBe(status);
  });

  it('fetchStudyPlanToday 使用长 timeout, 允许后端 10s LLM 超时后返回 fallback', async () => {
    const spy = vi.spyOn(api, 'get').mockResolvedValue(buildPlan('fallback_llm_failed'));

    await fetchStudyPlanToday();

    expect(spy).toHaveBeenCalledWith('/study-plan/today', { timeout: 15_000 });
  });
});

describe('usePatchStudyTask · 乐观更新 + onError rollback', () => {
  it('skipped 路径: 乐观 cache status=skipped, completedAt=null (review P0-3)', async () => {
    const initial = buildPlan('success');
    client.setQueryData<StudyPlanResponse>(studyPlanKeys.today(), initial);

    server.use(
      http.patch('/api/v2/study-plan/tasks/:taskId', () =>
        HttpResponse.json({
          ...initial.tasks[0],
          status: 'skipped',
          completedAt: null,
        }),
      ),
    );

    const { result } = renderHook(() => usePatchStudyTask(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 10, status: 'skipped' });
    });
    const after = client.getQueryData<StudyPlanResponse>(studyPlanKeys.today());
    expect(after?.tasks[0].status).toBe('skipped');
    expect(after?.tasks[0].completedAt).toBeNull();
  });

  it('mutate 失败 → cache rollback 回到 pending (强 assert getQueryData)', async () => {
    // 预置 cache: 1 个 pending task
    const initial = buildPlan('success');
    client.setQueryData<StudyPlanResponse>(studyPlanKeys.today(), initial);

    // BE 反复返 500 → mutation onError 触发
    server.use(
      http.patch('/api/v2/study-plan/tasks/:taskId', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => usePatchStudyTask(), {
      wrapper: wrapper(client),
    });

    // mutate 触发 onMutate (乐观更新) → BE fail → onError (rollback)
    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 10, status: 'completed' });
      } catch {
        /* 期望失败 */
      }
    });

    // 强 assert: cache 必须回到 'pending', 而不是停留 'completed'.
    const after = client.getQueryData<StudyPlanResponse>(studyPlanKeys.today());
    expect(after).toBeDefined();
    expect(after?.tasks[0].status).toBe('pending');
    expect(after?.tasks[0].completedAt).toBeNull();
  });
});

describe('useStartStudyPlanSession · payload 构造', () => {
  it('practice 带 paperCode + questionIds → 端点收到完整 payload', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post('/api/v2/practice/study-plan/start', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          sections: [],
          savedAnswers: {},
          sessionId: 99,
          paperCode: 'D1',
          paperRevisionId: 1,
        });
      }),
    );

    const { result } = renderHook(() => useStartStudyPlanSession(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ paperCode: 'D1', questionIds: [1, 2] });
    });

    expect(receivedBody).toEqual({ paperCode: 'D1', questionIds: [1, 2] });
    expect(result.current.data?.sessionId).toBe(99);
  });

  it('review_wrong 仅 questionIds → 端点收到 paperCode 缺失', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.post('/api/v2/practice/study-plan/start', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          sections: [],
          savedAnswers: {},
          sessionId: 100,
        });
      }),
    );

    const { result } = renderHook(() => useStartStudyPlanSession(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync({ questionIds: [3, 4] });
    });

    expect(receivedBody).toEqual({ questionIds: [3, 4] });
  });
});

// ── Slice 3c: useStudyPlanHistory ────────────────────────────────────────

function buildHistoryPage(
  startDayBack: number,
  count: number,
  nextCursor: string | null,
): StudyPlanHistoryListV2 {
  // 生成 count 条 plan, plan_date = today - startDayBack ... - (startDayBack+count-1)
  const items = Array.from({ length: count }, (_, i) => {
    const d = new Date('2026-04-30');
    d.setUTCDate(d.getUTCDate() - (startDayBack + i));
    return {
      id: 100 + i + startDayBack,
      planDate: d.toISOString().slice(0, 10),
      generationStatus: 'success' as const,
      taskTotal: 5,
      taskCompleted: 3,
      createdAt: '2026-04-29T00:00:00Z',
    };
  });
  return { items, nextCursor };
}

describe('useStudyPlanHistory · cursor 分页 + retry policy', () => {
  it('首页解析 items + nextCursor', async () => {
    server.use(
      http.get('/api/v2/study-plan/history', ({ request }) => {
        const url = new URL(request.url);
        // 首页应该不带 cursor
        expect(url.searchParams.has('cursor')).toBe(false);
        expect(url.searchParams.get('limit')).toBe('20');
        return HttpResponse.json(buildHistoryPage(1, 2, '2026-04-28'));
      }),
    );

    const { result } = renderHook(() => useStudyPlanHistory(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pages = result.current.data?.pages;
    expect(pages?.length).toBe(1);
    expect(pages?.[0].items.length).toBe(2);
    expect(pages?.[0].nextCursor).toBe('2026-04-28');
    expect(result.current.hasNextPage).toBe(true);
  });

  it('fetchNextPage 把 cursor 透传到 BE 并把第二页拼到 pages[1]', async () => {
    let callCount = 0;
    const observed: string[] = [];
    server.use(
      http.get('/api/v2/study-plan/history', ({ request }) => {
        callCount += 1;
        const url = new URL(request.url);
        observed.push(url.searchParams.get('cursor') ?? '<none>');
        if (callCount === 1) {
          return HttpResponse.json(buildHistoryPage(1, 2, '2026-04-28'));
        }
        return HttpResponse.json(buildHistoryPage(3, 2, null));
      }),
    );

    const { result } = renderHook(() => useStudyPlanHistory(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    void result.current.fetchNextPage();
    // useInfiniteQuery state update 可能滞后于 fetchNextPage promise resolve;
    // 用 waitFor 守第 2 页落到 data.pages 上.
    await waitFor(() =>
      expect(result.current.data?.pages.length).toBe(2),
    );

    expect(observed).toEqual(['<none>', '2026-04-28']);
    expect(result.current.data?.pages[1].items.length).toBe(2);
    expect(result.current.data?.pages[1].nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
  });

  it('401 不 retry (跟 today 一致, 共享 shouldRetry)', async () => {
    let attempts = 0;
    server.use(
      http.get('/api/v2/study-plan/history', () => {
        attempts += 1;
        return HttpResponse.json({ detail: 'unauth' }, { status: 401 });
      }),
    );

    const apiSpy = vi.spyOn(api, 'get');

    // 用一个新 client 让 retry policy 生效 (makeClient 默认 retry: false 会
    // 屏蔽我们要测的 shouldRetry 逻辑); 这里覆盖 default 让 shouldRetry 接管.
    const retryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 60_000, staleTime: 0 } },
    });
    const { result } = renderHook(() => useStudyPlanHistory(), {
      wrapper: wrapper(retryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3000,
    });

    // 401 → shouldRetry 返 false → 应只被打 1 次 (msw handler)
    expect(attempts).toBe(1);
    apiSpy.mockRestore();
  });

  it('fetchStudyPlanHistory 拼 cursor=undefined 时 URL 不带 cursor 参数', async () => {
    const spy = vi.spyOn(api, 'get').mockResolvedValue(
      buildHistoryPage(1, 1, null),
    );

    await fetchStudyPlanHistory(undefined);

    expect(spy).toHaveBeenCalledWith('/study-plan/history?limit=20');
  });
});

// ── Slice 3d: useStudyPlanDetail ─────────────────────────────────────────

describe('useStudyPlanDetail · happy path + 404 retry policy', () => {
  it('成功响应解析完整 plan + tasks (复用 StudyPlanResponse)', async () => {
    // P2-5 v0.2 review: BE 响应 plan id=42 (跟 path 一致), 而非 buildPlan
    // 默认 1 — 测试要 verify fetcher 真的用了 planId 拼路径, 不只是 mock 返回.
    const detailPlan = { ...buildPlan('success'), id: 42 };
    server.use(
      http.get('/api/v2/study-plan/42', () => HttpResponse.json(detailPlan)),
    );

    const { result } = renderHook(() => useStudyPlanDetail(42), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(42);
    expect(result.current.data?.tasks.length).toBe(1);
  });

  it('404 不 retry (shouldRetry 加 404 分支, attempts=1 单次)', async () => {
    let attempts = 0;
    server.use(
      http.get('/api/v2/study-plan/999', () => {
        attempts += 1;
        return HttpResponse.json({ detail: 'not found' }, { status: 404 });
      }),
    );

    // makeClient default retry: false 屏蔽 shouldRetry — 用真 retry policy
    const retryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 60_000, staleTime: 0 } },
    });
    const { result } = renderHook(() => useStudyPlanDetail(999), {
      wrapper: wrapper(retryClient),
    });
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 3000,
    });
    // 404 → shouldRetry 返 false → attempts=1
    expect(attempts).toBe(1);
  });
});
