import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  collectDoneFrame,
  HomeStreamFrameError,
  streamJsonSsePost,
} from '@sikao/api-client/homeStream';
import type { HomePlanGenerateStreamFrame } from '@sikao/api-client/types/home';

function makeReadableStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

beforeEach(() => {
  document.cookie = 'csrf_token_v2=stream-test';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('home stream helper', () => {
  it('parses event/done frames and forwards Idempotency-Key and CSRF headers', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: makeReadableStream([
        'data: {"type":"event","event":{"id":"11:2026-05-22","planId":11,"title":"Plan item","category":"xingce","notes":"","startAt":"2026-05-22T01:00:00.000Z","endAt":"2026-05-22T02:00:00.000Z","timezone":"Asia/Shanghai","status":"planned","source":"user_manual","parentId":null,"recurringRule":null,"recurringParentId":null,"recurringExceptionDates":[],"linkedSessionId":null,"targetId":null,"deletedAt":null,"isRecurringInstance":false}}\n\n',
        'data: {"type":"done","plan":{"id":11,"name":"Plan","targetExamId":"GK-2026","targetExamDate":"2026-08-10","dailyMinutesTarget":120,"style":"balanced","baseline":{},"focusSubjects":[],"status":"active","source":"user_manual","changeLog":[],"deletedAt":null,"archivedAt":null,"createdAt":"2026-05-22T00:00:00Z","updatedAt":"2026-05-22T00:00:00Z"},"events":[],"eventCount":0,"llmCallId":88}\n\n',
      ]),
      text: async () => '',
      headers: new Headers(),
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const frames: HomePlanGenerateStreamFrame[] = [];

    const doneFrame = await collectDoneFrame(
      streamJsonSsePost<HomePlanGenerateStreamFrame>(
        '/plans/auto-generate',
        { name: 'Plan' },
        {
          signal: controller.signal,
          idempotencyKey: '00000000-0000-4000-8000-000000000000',
        },
      ),
      (frame) => {
        frames.push(frame);
      },
    );

    expect(doneFrame.type).toBe('done');
    expect(frames.map((frame) => frame.type)).toEqual(['event', 'done']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000000');
    expect(headers['X-CSRF-Token']).toBe('stream-test');
  });

  it('turns error frames into HomeStreamFrameError', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: makeReadableStream([
        'data: {"type":"error","code":"plan_generate_empty","message":"no events"}\n\n',
      ]),
      text: async () => '',
      headers: new Headers(),
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      collectDoneFrame(
        streamJsonSsePost<HomePlanGenerateStreamFrame>(
          '/plans/auto-generate',
          { name: 'Plan' },
          {
            signal: new AbortController().signal,
          },
        ),
      ),
    ).rejects.toBeInstanceOf(HomeStreamFrameError);
  });
});
