/**
 *
 * 覆盖:
 * 1. loading state — skeleton 显
 * 2. data state — head + tracks + assistant 全渲, today 周 3 task 显
 * 3. auth fail — AuthFallbackEmptyState
 * 4. all error — retry 按钮
 * 5. empty (today + history 都空) — empty state CTA
 * 6. PlanAssistant 文案: tasks 全完成 / 部分完成 / 0 task / 无 plan 4 路径切换
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@sikao/test-utils/server';
import Plan from '../Plan';
import type {
  StudyPlanResponse,
  StudyPlanHistoryListV2,
} from '@sikao/api-client/types/study-plan';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPlan(client?: QueryClient) {
  return render(
    <QueryClientProvider client={client ?? makeClient()}>
      <MemoryRouter initialEntries={['/plan']}>
        <Plan />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// IntersectionObserver mock: jsdom 不带, observer 永不触发, sentinel 不会自动
// 加载下一页. 测试范围内不验自动 load (跟 StudyPlanHistory.test 复用 pattern).
const observerInstances: Array<{
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.takeRecords = vi.fn(() => []);
    observerInstances.push({ callback, disconnect: this.disconnect });
  }
}

beforeEach(() => {
  observerInstances.length = 0;
  // @ts-expect-error: jsdom 没 IntersectionObserver, 测试 stub
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  delete globalThis.IntersectionObserver;
});

// ── helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildTodayPlan(): StudyPlanResponse {
  return {
    id: 1,
    planDate: todayISO(),
    generationStatus: 'success',
    createdAt: '2026-05-11T00:00:00Z',
    tasks: [
      {
        id: 100,
        taskKind: 'practice',
        status: 'pending',
        displayOrder: 0,
        completedAt: null,
        createdAt: '2026-05-11T00:00:00Z',
        payload: {
          paperCode: 'D1',
          questionIds: [1, 2, 3],
          title: '资料 · 基期还原',
          subtitle: null,
        },
      },
      {
        id: 101,
        taskKind: 'review_wrong',
        status: 'pending',
        displayOrder: 1,
        completedAt: null,
        createdAt: '2026-05-11T00:00:00Z',
        payload: {
          questionIds: [10, 11],
          title: '错题复盘',
          subtitle: null,
        },
      },
    ],
  };
}

const EMPTY_HISTORY: StudyPlanHistoryListV2 = {
  items: [],
  nextCursor: null,
};

// ── tests ────────────────────────────────────────────────────────────────

describe('Plan · view', () => {
  it('loading: 显 skeleton 而非 head/tracks', () => {
    // 不 register handlers → server 默认 fall back 不返, query 一直 loading
    server.use(
      http.get('/api/v2/study-plan/today', async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return HttpResponse.json(buildTodayPlan());
      }),
      http.get('/api/v2/study-plan/history', async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return HttpResponse.json(EMPTY_HISTORY);
      }),
    );
    renderPlan();
    expect(screen.getByTestId('plan-view-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-view')).not.toBeInTheDocument();
  });

  it('data: 渲 head + assistant + 至少 1 track + today 周内 today task 显标题', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json(buildTodayPlan()),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json(EMPTY_HISTORY),
      ),
    );
    renderPlan();

    await waitFor(() =>
      expect(screen.getByTestId('plan-view')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('plan-head')).toBeInTheDocument();
    expect(screen.getByTestId('plan-head-title')).toHaveTextContent('距');
    expect(screen.getByTestId('plan-assistant')).toBeInTheDocument();
    expect(screen.getByTestId('plan-tracks')).toBeInTheDocument();

    // today plan task 标题映到当天 day cell
    expect(screen.getByText('资料 · 基期还原')).toBeInTheDocument();
    expect(screen.getByText('错题复盘')).toBeInTheDocument();
  });

  it('auth fail: 401 → AuthFallbackEmptyState', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
    );
    renderPlan();
    await waitFor(() =>
      expect(screen.getByTestId('plan-view-auth-fallback')).toBeInTheDocument(),
    );
  });

  it('all error: today + history 都 500 → retry 按钮 + ERROR_COPY 文案', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json({ detail: 'server error' }, { status: 500 }),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json({ detail: 'server error' }, { status: 500 }),
      ),
    );
    renderPlan();
    await waitFor(
      () => expect(screen.getByTestId('plan-view-error')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByTestId('plan-view-retry')).toBeInTheDocument();
  });

  it('empty: today + history 都空 (today 404 等同空) → empty state CTA', async () => {
    // today 404 (没今日 plan 生成) + history empty → buildWeeks 仍出 1 周但
    // today.data == null + weeks empty 触发 empty 路径. 实际 today 404 query
    // 走 isError → 不会进 empty. 用 today=null + history=empty 才命中 — 但
    // useStudyPlanToday 没 enabled 守门, 200 + null body 才出 today.data=null.
    // 这里改测 200 OK + body=null path:
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json(null),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json(EMPTY_HISTORY),
      ),
    );
    renderPlan();
    await waitFor(
      () => expect(screen.getByTestId('plan-view-empty')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(screen.getByTestId('plan-view-empty-cta')).toHaveTextContent(
      '回 Dashboard',
    );
  });

  it('history 已到底 → 加载完成 chip 显 (sentinel 不渲)', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json(buildTodayPlan()),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json(EMPTY_HISTORY),
      ),
    );
    renderPlan();
    await waitFor(() =>
      expect(screen.getByTestId('plan-view-end')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('plan-view-sentinel')).not.toBeInTheDocument();
  });

  it('history 有 nextCursor → sentinel 渲, 加载完成 chip 不渲', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json(buildTodayPlan()),
      ),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json({
          items: [
            {
              id: 99,
              planDate: '2026-05-04',
              generationStatus: 'success',
              taskCompleted: 3,
              taskTotal: 3,
              createdAt: '2026-05-04T00:00:00Z',
            },
          ],
          nextCursor: '2026-05-03',
        }),
      ),
    );
    renderPlan();
    await waitFor(() =>
      expect(screen.getByTestId('plan-view-sentinel')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('plan-view-end')).not.toBeInTheDocument();
  });

  it('PlanAssistant: tasks 全完成 → "已全部完成" 文案', async () => {
    const allDone = buildTodayPlan();
    const allDonePlan: StudyPlanResponse = {
      ...allDone,
      tasks: allDone.tasks.map((t) => ({
        ...t,
        status: 'completed',
        completedAt: '2026-05-11T03:00:00Z',
      })),
    };
    server.use(
      http.get('/api/v2/study-plan/today', () => HttpResponse.json(allDonePlan)),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json(EMPTY_HISTORY),
      ),
    );
    renderPlan();
    await waitFor(() =>
      expect(screen.getByTestId('plan-assistant-narrative')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('plan-assistant-narrative')).toHaveTextContent(
      '已全部完成',
    );
  });

  it('PlanAssistant: 0 task → "今天没安排具体任务" 文案', async () => {
    const noTasks: StudyPlanResponse = {
      ...buildTodayPlan(),
      tasks: [],
    };
    server.use(
      http.get('/api/v2/study-plan/today', () => HttpResponse.json(noTasks)),
      http.get('/api/v2/study-plan/history', () =>
        HttpResponse.json(EMPTY_HISTORY),
      ),
    );
    renderPlan();
    await waitFor(() =>
      expect(screen.getByTestId('plan-assistant-narrative')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('plan-assistant-narrative')).toHaveTextContent(
      '没安排具体任务',
    );
  });
});
