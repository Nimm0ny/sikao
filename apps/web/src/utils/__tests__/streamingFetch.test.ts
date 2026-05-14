import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { streamSsePost, StreamingHttpError } from '../streamingFetch';

// streamingFetch 测试: 模拟 fetch + ReadableStream, 验证 SSE 帧拆包 + 错误
// 路径. 不依赖 msw — fetch 直接 monkey-patch (msw v2 ReadableStream support
// 取决于 jsdom undici 实现, 直接 stub 更稳).

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
}

function mockFetchOnce(opts: {
  body: ReadableStream<Uint8Array> | null;
  status?: number;
  statusText?: string;
}) {
  const response = new Response(opts.body, {
    status: opts.status ?? 200,
    statusText: opts.statusText,
    headers: { 'Content-Type': 'text/event-stream' },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  // csrf cookie set; readCsrfTokenFromCookie 读 document.cookie.
  document.cookie = 'csrf_token=test-csrf';
});

afterEach(() => {
  // 必须 unstub fetch 让后续 test files (msw 拦 fetch) 不被污染.
  vi.unstubAllGlobals();
});

describe('streamSsePost', () => {
  it('单 chunk 一帧: yield delta 帧', async () => {
    mockFetchOnce({
      body: makeReadableStream(['data: {"type":"delta","content":"Hi"}\n\n']),
    });
    const ctl = new AbortController();
    const frames = [];
    for await (const f of streamSsePost('/x', {}, ctl.signal)) frames.push(f);
    expect(frames).toEqual([{ type: 'delta', content: 'Hi' }]);
  });

  it('多 chunk 跨 frame 边界: 缓冲拼接 + 拆出完整帧', async () => {
    // 一个完整帧被拆成两个 chunk; 第二个 chunk 含下一帧.
    mockFetchOnce({
      body: makeReadableStream([
        'data: {"type":"delta","co',
        'ntent":"Ab"}\n\ndata: {"type":"done","messageId":42,"conversationId":7}\n\n',
      ]),
    });
    const frames = [];
    const ctl = new AbortController();
    for await (const f of streamSsePost('/x', {}, ctl.signal)) frames.push(f);
    expect(frames).toEqual([
      { type: 'delta', content: 'Ab' },
      { type: 'done', messageId: 42, conversationId: 7 },
    ]);
  });

  it('created 帧 (3rd review P1 #3): stream 开头 yield conversationId', async () => {
    mockFetchOnce({
      body: makeReadableStream([
        'data: {"type":"created","conversationId":42}\n\n',
        'data: {"type":"delta","content":"Hi"}\n\n',
      ]),
    });
    const ctl = new AbortController();
    const frames = [];
    for await (const f of streamSsePost('/x', {}, ctl.signal)) frames.push(f);
    expect(frames[0]).toEqual({ type: 'created', conversationId: 42 });
    expect(frames[1]).toEqual({ type: 'delta', content: 'Hi' });
  });

  it('error 帧 yield (caller decide 是否 break)', async () => {
    mockFetchOnce({
      body: makeReadableStream([
        'data: {"type":"error","code":"llm_timeout","message":"超时"}\n\n',
      ]),
    });
    const frames = [];
    const ctl = new AbortController();
    for await (const f of streamSsePost('/x', {}, ctl.signal)) frames.push(f);
    expect(frames[0]).toMatchObject({ type: 'error', code: 'llm_timeout' });
  });

  it('HTTP 非 2xx → StreamingHttpError', async () => {
    mockFetchOnce({ body: null, status: 403 });
    const ctl = new AbortController();
    await expect(async () => {
      for await (const frame of streamSsePost('/x', {}, ctl.signal)) {
        void frame;
      }
    }).rejects.toBeInstanceOf(StreamingHttpError);
  });

  it('CSRF header 注入: X-CSRF-Token from cookie', async () => {
    mockFetchOnce({ body: makeReadableStream([]) });
    const ctl = new AbortController();
    for await (const frame of streamSsePost('/x', {}, ctl.signal)) {
      void frame;
    }
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf' });
  });

  it('malformed JSON in data line → throws (fail-fast, no silent drop)', async () => {
    mockFetchOnce({
      body: makeReadableStream(['data: {bad-json}\n\n']),
    });
    const ctl = new AbortController();
    await expect(async () => {
      for await (const frame of streamSsePost('/x', {}, ctl.signal)) {
        void frame;
      }
    }).rejects.toThrow();
  });
});
