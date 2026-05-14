/**
 * SIKAO Wave 4 X2 · examEventsQueries hooks 测试.
 *
 * 覆盖 useNationalExamCountdown 三态:
 * 1. data 路径: BE 返多 category 时 filter national + 升序 pick first
 * 2. fallback 路径: loading / 空集 / 全非 national → DEFAULT_EXAM_DATE_ISO
 * 3. error 路径: BE 500 → toast.error + fallback (graceful 非 silent)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@sikao/test-utils/server';
import {
  useNationalExamCountdown,
  type ExamEventListResponse,
} from '../examEventsQueries';
import {
  DEFAULT_EXAM_DATE_ISO,
  DEFAULT_EXAM_LABEL,
} from '@sikao/domain/study-record/exam-countdown';
import { toast } from '@sikao/shared-utils';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 60_000, staleTime: 0 },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

let client: QueryClient;
beforeEach(() => {
  client = makeClient();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useNationalExamCountdown · data 路径', () => {
  it('多 category 时 filter national + 升序 pick first', async () => {
    const payload: ExamEventListResponse = {
      items: [
        {
          id: 1,
          slug: 'provincial-2030',
          name: '2030 省考',
          category: 'provincial',
          examDate: '2030-03-15',
          precision: 'confirmed',
        },
        {
          id: 2,
          slug: 'national-2030',
          name: '2030 国考',
          category: 'national',
          examDate: '2030-11-29',
          precision: 'confirmed',
        },
        {
          id: 3,
          slug: 'national-2029',
          name: '2029 国考',
          category: 'national',
          examDate: '2029-11-25',
          precision: 'confirmed',
        },
      ],
    };
    server.use(
      http.get('/api/v2/exam-events', () => HttpResponse.json(payload)),
    );

    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFallback).toBe(false);
    expect(result.current.examDateISO).toBe('2029-11-25');
    expect(result.current.examLabel).toBe('2029 国考');
    expect(typeof result.current.daysUntil).toBe('number');
  });
});

describe('useNationalExamCountdown · fallback 路径', () => {
  it('空集 → DEFAULT_EXAM_DATE_ISO 兜底', async () => {
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFallback).toBe(true);
    expect(result.current.examDateISO).toBe(DEFAULT_EXAM_DATE_ISO);
    expect(result.current.examLabel).toBe(DEFAULT_EXAM_LABEL);
  });

  it('items 全非 national → fallback', async () => {
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({
          items: [
            {
              id: 9,
              slug: 'provincial-x',
              name: '2030 省考',
              category: 'provincial',
              examDate: '2030-03-15',
              precision: 'confirmed',
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFallback).toBe(true);
    expect(result.current.examDateISO).toBe(DEFAULT_EXAM_DATE_ISO);
  });

  it('loading 初态 → fallback + isLoading=true', () => {
    server.use(
      http.get('/api/v2/exam-events', async () => {
        // 永不 resolve, 测 loading 态.
        await new Promise(() => {});
        return HttpResponse.json({ items: [] });
      }),
    );

    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFallback).toBe(true);
    expect(result.current.examDateISO).toBe(DEFAULT_EXAM_DATE_ISO);
  });
});

describe('useNationalExamCountdown · error 路径', () => {
  it('BE 500 → fallback + toast.error 通知 (graceful 非 silent)', async () => {
    const toastSpy = vi.spyOn(toast, 'error');
    server.use(
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    // 5xx 走 retry 2 次, 等 isError=true (final) 而不是 !isLoading.
    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), {
      timeout: 5000,
    });
    expect(result.current.isFallback).toBe(true);
    expect(result.current.examDateISO).toBe(DEFAULT_EXAM_DATE_ISO);
    expect(toastSpy.mock.calls[0][0]).toBe('考期数据加载失败');
  });

  it('4xx 不 retry (shouldRetry 共享)', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v2/exam-events', () => {
        calls++;
        return HttpResponse.json({ detail: 'forbidden' }, { status: 403 });
      }),
    );

    const { result } = renderHook(() => useNationalExamCountdown(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(calls).toBe(1);
    expect(result.current.isFallback).toBe(true);
  });
});
