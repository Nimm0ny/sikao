// Slice 1b — fetch + ReadableStream SSE consumer for /api/v2/llm/conversations.
//
// Why fetch instead of EventSource (plan §3.3.1):
//   EventSource API does not support custom headers; we need X-CSRF-Token on
//   mutating requests (Phase B double-submit cookie). fetch + body.getReader()
//   lets us tee SSE frames ourselves while still attaching the CSRF header.
//
// Frame layout produced by backend (`_sse_frame`, llm_conversations_v2.py):
//   data: {"type":"delta","content":"..."}\n\n
//   data: {"type":"done","messageId":N}\n\n
//   data: {"type":"error","code":"...","message":"..."}\n\n
//
// Cancel: caller passes an AbortSignal. fetch() observes it and aborts the
// underlying request; backend `await request.is_disconnected()` then exits
// the generator → upstream LLM call is cancelled (no more billable tokens).

import type { LlmStreamFrame } from '@sikao/api-client/types/api';
import { API_BASE_URL, readCsrfTokenFromCookie } from './request';

const SSE_FRAME_DELIMITER = '\n\n';
const SSE_DATA_PREFIX = 'data: ';

/**
 * POST a JSON body to a streaming SSE endpoint and yield frames as they
 * arrive. Throws on HTTP non-2xx, on missing response body, and on parse
 * errors (callers should surface fail-fast per harness §3.1).
 *
 * Caller is responsible for awaiting `for await` to completion or aborting
 * via `signal`. Aborting mid-stream surfaces as a DOMException (name =
 * 'AbortError'); callers should swallow that specific case.
 */
export async function* streamSsePost(
  path: string,
  body: unknown,
  signal: AbortSignal,
): AsyncIterable<LlmStreamFrame> {
  const csrf = readCsrfTokenFromCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (csrf !== null) headers['X-CSRF-Token'] = csrf;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    // Read text best-effort so caller can surface server's error message.
    const detail = await response.text().catch(() => '');
    throw new StreamingHttpError(response.status, detail);
  }
  if (response.body === null) {
    throw new Error('streamingFetch: response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Split on \n\n; last segment may be partial — keep in buffer.
      let delimiterIdx = buffer.indexOf(SSE_FRAME_DELIMITER);
      while (delimiterIdx !== -1) {
        const rawFrame = buffer.slice(0, delimiterIdx);
        buffer = buffer.slice(delimiterIdx + SSE_FRAME_DELIMITER.length);
        const parsed = parseSseFrame(rawFrame);
        if (parsed !== null) yield parsed;
        delimiterIdx = buffer.indexOf(SSE_FRAME_DELIMITER);
      }
    }
    // Tail: emit any remaining complete frame after stream end (rare).
    const tail = buffer.trim();
    if (tail.length > 0) {
      const parsed = parseSseFrame(tail);
      if (parsed !== null) yield parsed;
    }
  } finally {
    // Ensure we release the lock even on caller throw / abort.
    reader.releaseLock();
  }
}

export class StreamingHttpError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(`streamingFetch: HTTP ${status}`);
    this.name = 'StreamingHttpError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Parse a single SSE frame line ("data: {...}"). Returns null for unknown
 * lines (comments, keep-alives) and throws on malformed JSON so the caller
 * can fail-fast (corrupt frames must not be silently dropped per §3.1).
 */
function parseSseFrame(rawFrame: string): LlmStreamFrame | null {
  const line = rawFrame.trim();
  if (line.length === 0) return null;
  if (!line.startsWith(SSE_DATA_PREFIX)) return null;
  const json = line.slice(SSE_DATA_PREFIX.length);
  // The backend never emits "[DONE]" sentinel — it emits typed frames only.
  // A literal "[DONE]" here would be a contract violation; fail loud.
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'type' in parsed &&
    typeof (parsed as { type: unknown }).type === 'string'
  ) {
    return parsed as LlmStreamFrame;
  }
  throw new Error(`streamingFetch: malformed frame: ${json}`);
}
