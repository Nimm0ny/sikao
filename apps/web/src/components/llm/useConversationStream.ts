// useConversationStream — Slice 1b SSE consumer hook.
//
// 包装 streamingFetch.ts 给 React state machine. 单次 send 期间累积 partial
// 文本, 末尾 'done' frame 标 conversationId / messageId 给 caller. 失败 frame
// 转 error 字符串. abort() 取消 fetch, backend `is_disconnected` 触发 upstream
// cancel.
//
// 状态转移:
//   idle → streaming (delta accumulating) → done | error | aborted
//   再次 send → 重置 partial / error
//
// 不返完整消息列表 — caller (ChatPanel) 自己 merge. 这样 hook 保持 stateless
// for messages, 只管单次流式输出.

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@sikao/shared-utils';
import { streamSsePost, StreamingHttpError } from '@/utils/streamingFetch';
import type { LlmStreamFrame } from '@sikao/api-client/types/api';

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'aborted';

export interface ConversationStreamState {
  readonly status: StreamStatus;
  readonly partial: string;
  readonly error: string | null;
  readonly lastMessageId: number | null;
  // `done.conversationId` 落到 hook state 让 caller (ChatPanel) 续话用. null
  // 在 streaming / error / aborted 时.
  readonly lastConversationId: number | null;
}

export interface ConversationStreamActions {
  /**
   * Start a streaming POST. `path` 是相对 `/api/v2` 的 endpoint
   * (e.g. `/llm/conversations` 或 `/llm/conversations/{id}/messages`).
   * 重复调用会 abort 旧 stream 再启新的.
   */
  start: (path: string, body: unknown) => Promise<void>;
  /** Mid-stream cancel; backend 收 disconnect 后 cancel upstream LLM call. */
  abort: () => void;
  /** 把 partial / error 清回 idle, 用于 send 完成后 ChatPanel 提交 final 消息. */
  reset: () => void;
}

export interface ConversationStreamCompletion {
  readonly messageId: number;
  readonly conversationId: number;
  readonly content: string;
}

export interface ConversationStreamErrorContext {
  /** copyKey 落 ERROR_COPY (e.g. 'llmQaUpstream'). UI 用此查文案. */
  readonly copyKey: string;
  /** backend 在 Phase 1 commit 后可带 conversationId, 让 caller 续话避免
   *  重发创建孤立 conversation row (Slice 1b-1 2nd review P1 #2). */
  readonly conversationId: number | undefined;
}

export interface UseConversationStreamOptions {
  /**
   * 在 done frame 收到后立即调用 (同步, 在 hook setState 之前). caller 用此
   * commit assistant message 入自己的 list, 避免在 useEffect 内 setState
   * (react-hooks/set-state-in-effect lint).
   */
  readonly onDone?: (completion: ConversationStreamCompletion) => void;
  /**
   * 在 error frame 收到后立即调用 (同步). caller 用此把 backend 携带的
   * conversationId 同步到自己的 state — 让重发走续话 endpoint 而非创建新
   * conversation. 详见 Slice 1b-1 2nd review P1 #2.
   */
  readonly onError?: (ctx: ConversationStreamErrorContext) => void;
  /**
   * 在 stream 开头的 `created` frame 收到后立即调用. caller 用此把 backend
   * commit 的 conversationId 同步到自己的 state, 即使用户 mid-stream abort
   * 后重发也走续话端点不创建孤立 conv. 详见 Slice 1b-1 3rd review P1 #3.
   */
  readonly onCreated?: (conversationId: number) => void;
}

const ERROR_CODE_TO_COPY_KEY: Record<string, string> = {
  llm_upstream: 'llmQaUpstream',
  llm_timeout: 'llmQaTimeout',
  llm_network: 'llmQaNetwork',
  internal: 'llmQaInternal',
  persistence_failed: 'llmQaPersistence',
  empty_completion: 'llmQaUnknown',
  llm_config_missing: 'llmQaUpstream',
};

/**
 * Map a backend error code to a stable copy key for ERROR_COPY lookup. Caller
 * should resolve via `ERROR_COPY[returnValue]`. Unknown codes → 'llmQaUnknown'.
 */
export function mapErrorCodeToCopyKey(code: string): string {
  return ERROR_CODE_TO_COPY_KEY[code] ?? 'llmQaUnknown';
}

export function useConversationStream(
  options: UseConversationStreamOptions = {},
): ConversationStreamState & ConversationStreamActions {
  const { onDone, onError, onCreated } = options;
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const [lastConversationId, setLastConversationId] = useState<number | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setPartial('');
    setError(null);
    setLastMessageId(null);
    setLastConversationId(null);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current !== null) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const start = useCallback(async (path: string, body: unknown) => {
    // Cancel any in-flight stream before starting new one.
    if (abortRef.current !== null) abortRef.current.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;

    setStatus('streaming');
    setPartial('');
    setError(null);
    setLastMessageId(null);
    setLastConversationId(null);

    try {
      let accumulated = '';
      for await (const frame of streamSsePost(path, body, ctl.signal)) {
        // Frame discriminated union; switch is exhaustive per LlmStreamFrame.
        const handled = handleFrame(frame, {
          markCreated: (conversationId) => {
            // 3rd review P1 #3: stream 开头先拿 conversationId, abort 后重发不
            // 创建孤立 row.
            setLastConversationId(conversationId);
            onCreated?.(conversationId);
          },
          appendDelta: (delta) => {
            accumulated += delta;
            setPartial(accumulated);
          },
          markDone: (messageId, conversationId) => {
            // onDone callback 在 setState 之前调让 caller 同步 commit
            // (避免 caller 用 useEffect on status='done' 触发
            // react-hooks/set-state-in-effect lint). caller 应 useCallback
            // 包 onDone 让 hook deps 稳定.
            onDone?.({
              messageId,
              conversationId,
              content: accumulated,
            });
            setLastMessageId(messageId);
            setLastConversationId(conversationId);
            setStatus('done');
          },
          markError: (codeKey, conversationId) => {
            // backend error frame 在 Phase 1 commit 后可带 conversationId
            // (Slice 1b-1 2nd review P1 #2). onError callback 同步调让 caller
            // 续话避免重发创建孤立 conversation row.
            if (conversationId !== undefined) {
              setLastConversationId(conversationId);
            }
            onError?.({ copyKey: codeKey, conversationId });
            setError(codeKey);
            setStatus('error');
          },
        });
        if (handled === 'terminal') break;
      }
    } catch (err) {
      // AbortError 是用户主动 cancel, 不算 error.
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('aborted');
        return;
      }
      if (err instanceof StreamingHttpError) {
        logger.warn('llm.qa.http_error', { status: err.status });
        setError('llmQaUpstream');
      } else {
        logger.error('llm.qa.stream_failed', { err: String(err) });
        setError('llmQaNetwork');
      }
      setStatus('error');
    } finally {
      if (abortRef.current === ctl) abortRef.current = null;
    }
  }, [onDone, onError, onCreated]);

  // Cleanup on unmount: cancel in-flight stream.
  useEffect(() => {
    return () => {
      if (abortRef.current !== null) abortRef.current.abort();
    };
  }, []);

  return {
    status,
    partial,
    error,
    lastMessageId,
    lastConversationId,
    start,
    abort,
    reset,
  };
}

interface FrameHandlers {
  markCreated: (conversationId: number) => void;
  appendDelta: (delta: string) => void;
  markDone: (messageId: number, conversationId: number) => void;
  markError: (copyKey: string, conversationId: number | undefined) => void;
}

function handleFrame(
  frame: LlmStreamFrame,
  handlers: FrameHandlers,
): 'continue' | 'terminal' {
  switch (frame.type) {
    case 'created':
      handlers.markCreated(frame.conversationId);
      return 'continue';
    case 'delta':
      handlers.appendDelta(frame.content);
      return 'continue';
    case 'done':
      handlers.markDone(frame.messageId, frame.conversationId);
      return 'terminal';
    case 'error':
      handlers.markError(
        mapErrorCodeToCopyKey(frame.code),
        frame.conversationId,
      );
      return 'terminal';
  }
}
