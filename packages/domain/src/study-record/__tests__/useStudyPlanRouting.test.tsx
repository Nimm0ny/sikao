/**
 * Slice 3b · useStudyPlanRouting 跳转 wiring 测试 (plan §7 第 4 + 11 条).
 *
 * 覆盖:
 * 1. 三种 task_kind 跳转路径 (essay / practice w/ qids / review_wrong)
 * 2. cross_paper_material_unsupported 422 → toast.error 调用一次
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { renderHook, act, waitFor } from '@testing-library/react';
import { server } from '@sikao/test-utils/server';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { useStudyPlanRouting } from '../useStudyPlanRouting';
import type {
  EssayWritingTaskResponse,
  PracticeTaskResponse,
  ReviewWrongTaskResponse,
} from '@sikao/api-client/types/study-plan';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const toastError = vi.fn();
vi.mock('@sikao/shared-utils', async () => {
  const actual =
    await vi.importActual<typeof import('@sikao/shared-utils')>('@sikao/shared-utils');
  return {
    ...actual,
    toast: {
      info: vi.fn(),
      warn: vi.fn(),
      error: (title: string) => toastError(title),
      dismiss: vi.fn(),
    },
  };
});

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const TASK_BASE = {
  displayOrder: 0,
  status: 'pending' as const,
  completedAt: null,
  createdAt: '2026-04-30T00:00:00Z',
};

const PRACTICE_TASK: PracticeTaskResponse = {
  ...TASK_BASE,
  id: 1,
  taskKind: 'practice',
  payload: { paperCode: 'D1', questionIds: [1, 2], title: 'P', subtitle: null },
};

const REVIEW_TASK: ReviewWrongTaskResponse = {
  ...TASK_BASE,
  id: 2,
  taskKind: 'review_wrong',
  payload: { questionIds: [3, 4], title: 'R', subtitle: null },
};

const ESSAY_TASK: EssayWritingTaskResponse = {
  ...TASK_BASE,
  id: 3,
  taskKind: 'essay_writing',
  payload: { paperCode: 'E1', questionId: 99, title: 'E', subtitle: null },
};

beforeEach(() => {
  navigate.mockClear();
  toastError.mockClear();
  usePracticeStore.getState().clearSession();
});

describe('useStudyPlanRouting · 跳转 wiring', () => {
  it('essay_writing → /essay/exam/:paperCode (V2 整卷, 单题已下线)', () => {
    const client = makeClient();
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(ESSAY_TASK));
    expect(navigate).toHaveBeenCalledWith('/essay/exam/E1', {
      state: { studyTaskId: 3 },
    });
  });

  it('practice w/ questionIds → POST /study-plan/start → /practice/sessions/:sid', async () => {
    const client = makeClient();
    server.use(
      http.post('/api/v2/practice/study-plan/start', () =>
        HttpResponse.json({
          sections: [],
          savedAnswers: {},
          sessionId: 555,
        }),
      ),
    );
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(PRACTICE_TASK));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/practice/sessions/555'),
    );
    expect(usePracticeStore.getState().sessionData?.sessionId).toBe(555);
    expect(usePracticeStore.getState().currentStudyTaskId).toBe(1);
  });

  it('review_wrong → POST /study-plan/start → /practice/sessions/:sid', async () => {
    const client = makeClient();
    server.use(
      http.post('/api/v2/practice/study-plan/start', () =>
        HttpResponse.json({
          sections: [],
          savedAnswers: {},
          sessionId: 777,
        }),
      ),
    );
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(REVIEW_TASK));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/practice/sessions/777'),
    );
    expect(usePracticeStore.getState().sessionData?.sessionId).toBe(777);
    expect(usePracticeStore.getState().currentStudyTaskId).toBe(2);
  });

  it('completed task: handleTaskClick 不调 navigate 也不调 mutation (review P1-7)', () => {
    const client = makeClient();
    const completed = { ...PRACTICE_TASK, status: 'completed' as const };
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(completed));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('practice w/ questionIds=null: defensive 直跳 /papers/:paperCode (review P2-2)', () => {
    const client = makeClient();
    const wholepaper: PracticeTaskResponse = {
      ...PRACTICE_TASK,
      payload: {
        paperCode: 'D2',
        questionIds: null,
        title: '整卷',
        subtitle: null,
      },
    };
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(wholepaper));
    expect(navigate).toHaveBeenCalledWith('/papers/D2');
  });

  it('cross_paper_material_unsupported 422 → toast.error 友好文案', async () => {
    const client = makeClient();
    server.use(
      http.post('/api/v2/practice/study-plan/start', () =>
        HttpResponse.json(
          { detail: '材料题不支持', code: 'cross_paper_material_unsupported' },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderHook(() => useStudyPlanRouting(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.handleTaskClick(REVIEW_TASK));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0][0]).toContain('资料分析');
    expect(navigate).not.toHaveBeenCalled();
  });
});
