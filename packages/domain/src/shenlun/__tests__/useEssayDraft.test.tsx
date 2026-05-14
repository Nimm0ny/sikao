import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { server } from '@sikao/test-utils/server';
import {
  useEssayDraftAutosave,
  useEssayDraftQuery,
  useSaveEssayDraft,
} from '../useEssayDraft';

// useEssayDraft tests (PR13 P5 FE, 2026-05-13).
//
// 覆盖:
//   - useEssayDraftQuery: GET happy + 404 isError
//   - useSaveEssayDraft: POST payload 字段正确 (typed_draft + handwritten_draft_metadata)
//   - useEssayDraftAutosave: 2s debounce / 多次 change cancel-and-reset /
//     unmount cancel / enabled guard (questionId≤0) / 状态机 idle→saving→saved /
//     mutation error → 'unsaved'
//
// fake timers + 手 flush microtasks 让 mutation onSuccess/onError resolve.

const ESSAY_DRAFT_URL = '/api/v2/essay/drafts';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

// Flush both timers and microtasks. lodash debounce 内 setTimeout 走 fake,
// 但 mutation promise resolution 走 microtask — 两者交替 advance.
async function flushDebounceAndMicrotasks(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const MOCK_DRAFT_RESPONSE = {
  id: 42,
  questionId: 100,
  typedDraft: 'hello world',
  handwrittenDraftMetadata: null,
  savedAt: '2026-05-13T10:00:00.000Z',
  updatedAt: '2026-05-13T10:00:00.000Z',
};

describe('useEssayDraftQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET /essay/drafts/{question_id} returns draft on 200', async () => {
    server.use(
      http.get(`${ESSAY_DRAFT_URL}/:questionId`, ({ params }) => {
        return HttpResponse.json({
          ...MOCK_DRAFT_RESPONSE,
          questionId: Number(params.questionId),
        });
      }),
    );
    const client = makeClient();
    const { result } = renderHook(() => useEssayDraftQuery(100), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.questionId).toBe(100);
    expect(result.current.data?.typedDraft).toBe('hello world');
  });

  it('404 → isError true (caller view 处理 "无草稿" vs 真错误)', async () => {
    server.use(
      http.get(`${ESSAY_DRAFT_URL}/:questionId`, () => {
        return HttpResponse.json({ detail: 'draft not found' }, { status: 404 });
      }),
    );
    const client = makeClient();
    const { result } = renderHook(() => useEssayDraftQuery(999), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('questionId <= 0 → disabled (不 call BE)', () => {
    let called = false;
    server.use(
      http.get(`${ESSAY_DRAFT_URL}/:questionId`, () => {
        called = true;
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { result } = renderHook(() => useEssayDraftQuery(0), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });
});

describe('useSaveEssayDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('POST /essay/drafts payload 含 typed_draft + handwritten_draft_metadata', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(ESSAY_DRAFT_URL, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { result } = renderHook(() => useSaveEssayDraft(), {
      wrapper: wrapper(client),
    });
    act(() => {
      result.current.mutate({
        questionId: 100,
        typedDraft: 'hello',
        handwrittenDraftMetadata: { stroke_count: 5 },
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // axios sends camelCase as-is (CamelModel BE).
    expect(capturedBody).toEqual({
      questionId: 100,
      typedDraft: 'hello',
      handwrittenDraftMetadata: { stroke_count: 5 },
    });
  });

  it('mutation 不 retry 4xx (422 失败立即 isError)', async () => {
    let callCount = 0;
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        callCount += 1;
        return HttpResponse.json(
          { detail: 'typed_draft too long' },
          { status: 422 },
        );
      }),
    );
    const client = makeClient();
    const { result } = renderHook(() => useSaveEssayDraft(), {
      wrapper: wrapper(client),
    });
    act(() => {
      result.current.mutate({
        questionId: 100,
        typedDraft: 'x'.repeat(6000),
        handwrittenDraftMetadata: null,
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });
});

describe('useEssayDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('typed_draft change → 2s 后 POST /essay/drafts (debounce)', async () => {
    let callCount = 0;
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        callCount += 1;
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { rerender } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: 100,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );
    rerender({ typedDraft: 'first text' });

    // 1.5s — 还在 debounce window 内
    await flushDebounceAndMicrotasks(1500);
    expect(callCount).toBe(0);

    // 再 600ms 总 2.1s, 越 2s window
    await flushDebounceAndMicrotasks(600);
    await waitFor(() => expect(callCount).toBe(1));
  });

  it('debounce window 内多次 change cancel + reset timer (trailing 一次)', async () => {
    let callCount = 0;
    let lastPayload: unknown = null;
    server.use(
      http.post(ESSAY_DRAFT_URL, async ({ request }) => {
        callCount += 1;
        lastPayload = await request.json();
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { rerender } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: 100,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );

    rerender({ typedDraft: 'a' });
    await flushDebounceAndMicrotasks(1000);
    rerender({ typedDraft: 'ab' });
    await flushDebounceAndMicrotasks(1000);
    rerender({ typedDraft: 'abc' });
    // 到这里总 2s, 中间两次 rerender 应被 cancel.
    expect(callCount).toBe(0);

    // 等够 2s 让最后一次 trailing fire.
    await flushDebounceAndMicrotasks(2100);
    await waitFor(() => expect(callCount).toBe(1));
    expect(lastPayload).toMatchObject({
      questionId: 100,
      typedDraft: 'abc',
    });
  });

  it('unmount cancel pending debounce (no trailing call)', async () => {
    let callCount = 0;
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        callCount += 1;
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { rerender, unmount } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: 100,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );
    rerender({ typedDraft: 'pending' });
    await flushDebounceAndMicrotasks(1000);
    // 在 trailing 还没 fire 前 unmount.
    unmount();
    await flushDebounceAndMicrotasks(2000);
    expect(callCount).toBe(0);
  });

  it('questionId ≤0 不 call BE (mock data 阶段 placeholder)', async () => {
    let callCount = 0;
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        callCount += 1;
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { rerender, result } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: -1,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );
    rerender({ typedDraft: 'never call BE' });
    await flushDebounceAndMicrotasks(3000);
    expect(callCount).toBe(0);
    expect(result.current.saveStatus).toBe('idle');
  });

  it('状态机 idle → saving → saved (happy path)', async () => {
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        return HttpResponse.json(MOCK_DRAFT_RESPONSE);
      }),
    );
    const client = makeClient();
    const { rerender, result } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: 100,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );
    // initial 'idle' (无 last saved, 无 in-flight)
    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();

    rerender({ typedDraft: 'hi' });
    // 跨过 2s debounce → mutation fire → isPending true → 'saving'
    await flushDebounceAndMicrotasks(2100);
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it('mutation error → saveStatus "unsaved" (fail-fast, caller 决定 toast)', async () => {
    server.use(
      http.post(ESSAY_DRAFT_URL, () => {
        return HttpResponse.json(
          { detail: 'server boom' },
          { status: 500 },
        );
      }),
    );
    const client = makeClient();
    const { rerender, result } = renderHook(
      ({ typedDraft }: { typedDraft: string }) =>
        useEssayDraftAutosave({
          questionId: 100,
          typedDraft,
          handwrittenDraftMetadata: null,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { typedDraft: '' },
      },
    );
    rerender({ typedDraft: 'will fail' });
    await flushDebounceAndMicrotasks(2100);
    await waitFor(() => expect(result.current.saveStatus).toBe('unsaved'));
  });
});
