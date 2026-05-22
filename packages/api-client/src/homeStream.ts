import { API_BASE_URL, readCsrfTokenFromCookie } from './request';

const SSE_FRAME_DELIMITER = '\n\n';
const SSE_DATA_PREFIX = 'data: ';

export interface StreamJsonSsePostOptions {
  readonly signal: AbortSignal;
  readonly idempotencyKey?: string;
}

export class HomeStreamHttpError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`homeStream: HTTP ${status}`);
    this.name = 'HomeStreamHttpError';
    this.status = status;
    this.detail = detail;
  }
}

export class HomeStreamFrameError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HomeStreamFrameError';
    this.code = code;
  }
}

function parseSseFrame<TFrame>(rawFrame: string): TFrame | null {
  const line = rawFrame.trim();
  if (!line.startsWith(SSE_DATA_PREFIX)) return null;
  const payload = JSON.parse(line.slice(SSE_DATA_PREFIX.length)) as unknown;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    typeof (payload as { type: unknown }).type === 'string'
  ) {
    return payload as TFrame;
  }
  throw new Error('homeStream: malformed frame payload');
}

export async function* streamJsonSsePost<TFrame>(
  path: string,
  body: unknown,
  options: StreamJsonSsePostOptions,
): AsyncIterable<TFrame> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  };
  const csrfToken = readCsrfTokenFromCookie();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    credentials: 'include',
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HomeStreamHttpError(response.status, detail);
  }
  if (response.body === null) {
    throw new Error('homeStream: response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf(SSE_FRAME_DELIMITER);
      while (delimiterIndex !== -1) {
        const rawFrame = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + SSE_FRAME_DELIMITER.length);
        const parsed = parseSseFrame<TFrame>(rawFrame);
        if (parsed !== null) {
          yield parsed;
        }
        delimiterIndex = buffer.indexOf(SSE_FRAME_DELIMITER);
      }
    }

    const tail = buffer.trim();
    if (tail.length > 0) {
      const parsed = parseSseFrame<TFrame>(tail);
      if (parsed !== null) {
        yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function collectDoneFrame<TFrame extends { readonly type: string }>(
  frames: AsyncIterable<TFrame>,
  onProgress?: (frame: TFrame) => void,
): Promise<Extract<TFrame, { readonly type: 'done' }>> {
  for await (const frame of frames) {
    onProgress?.(frame);
    if (frame.type === 'error') {
      const payload = frame as TFrame & { readonly code: string; readonly message: string };
      throw new HomeStreamFrameError(payload.code, payload.message);
    }
    if (frame.type === 'done') {
      return frame as Extract<TFrame, { readonly type: 'done' }>;
    }
  }
  throw new Error('homeStream: stream ended without a done frame');
}
