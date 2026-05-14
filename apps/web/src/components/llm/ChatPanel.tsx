// ChatPanel — Slice 1b smart component.
//
// SidePanel 包裹的 AI 答疑面板. 多轮对话 + 流式渲染 + 5 类意图 chip + abort.
// 接 props: open / onClose / contextKind / contextId. 第一次 send 时 POST
// /llm/conversations 创建会话, 拿到 done.conversationId 后续话走 POST
// /llm/conversations/{id}/messages.
//
// State 模型:
//   - messages: 已 commit 完成的轮次 (含 user 输入 + assistant 完整回复)
//   - draft: 用户当前输入框内容
//   - intent: 当前选中的意图 (默认 freeform)
//   - conversationId: null 直到首条 done 帧后由 hook lastConversationId 设
//   - 流式 partial 来自 useConversationStream.partial
//
// 关闭时 abort 任何 in-flight stream 让 backend cancel upstream.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SendIcon, StopIcon } from '@sikao/ui/icons';
import { Button, SidePanel } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import { LLM_QA_COPY, ERROR_COPY } from '@/lib/ui-copy';
import { llmConversationsKeys } from '@sikao/api-client/apiQueries';
import type { LlmContextKind, LlmIntentHint } from '@sikao/api-client/types/api';
import { MessageBubble } from './MessageBubble';
import { StreamingText } from './StreamingText';
import { useConversationStream } from './useConversationStream';

interface CommittedMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

const INTENT_OPTIONS: ReadonlyArray<{ value: LlmIntentHint; label: string }> = [
  { value: 'why_wrong', label: LLM_QA_COPY.intentWhyWrong },
  { value: 'common_traps', label: LLM_QA_COPY.intentTraps },
  { value: 'solving_path', label: LLM_QA_COPY.intentSolvingPath },
  { value: 'category_summary', label: LLM_QA_COPY.intentCategory },
  { value: 'freeform', label: LLM_QA_COPY.intentFreeform },
];

export interface ChatPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly contextKind: LlmContextKind;
  readonly contextId?: number | null;
  /** Optional preset title; backend fallback 用首条 user_message 截断 */
  readonly title?: string | null;
}

export function ChatPanel({
  open,
  onClose,
  contextKind,
  contextId = null,
  title = null,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<CommittedMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [intent, setIntent] = useState<LlmIntentHint>('freeform');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // useCallback 稳定 onDone identity 让 hook 内 start callback 不每 render 重建.
  const handleDone = useCallback(
    ({
      messageId,
      conversationId: cid,
      content,
    }: {
      messageId: number;
      conversationId: number;
      content: string;
    }) => {
      setMessages((prev) => [
        ...prev,
        { id: messageId, role: 'assistant', content },
      ]);
      setConversationId(cid);
      queryClient.invalidateQueries({
        queryKey: llmConversationsKeys.list(),
      });
    },
    [queryClient],
  );

  // 2nd review P1 #2: error frame 带 conversationId 时 sync 到 ChatPanel state,
  // 让重发走 POST /messages (续话) 而不是 POST /conversations (新建), 避免
  // 库存孤立 conversation row. 用 setState updater 防 race (并发 done/error).
  const handleError = useCallback((ctx: { conversationId: number | undefined }) => {
    if (ctx.conversationId !== undefined) {
      setConversationId((prev) => prev ?? ctx.conversationId ?? null);
    }
  }, []);

  // 3rd review P1 #3: stream 开头 'created' 帧 sync conversationId, 让用户
  // mid-stream abort 后重发也走续话端点不创建孤立 conv.
  const handleCreated = useCallback((cid: number) => {
    setConversationId((prev) => prev ?? cid);
  }, []);

  const {
    status: streamStatus,
    partial,
    error: streamError,
    start: streamStart,
    abort: streamAbort,
    reset: streamReset,
  } = useConversationStream({
    onDone: handleDone,
    onError: handleError,
    onCreated: handleCreated,
  });

  // Stream done 后清 hook 内部 partial / lastMessageId state 让 idle 态恢复.
  // 这里仅 reset, 不 setState — Effect 安全 (CLAUDE.md 不警).
  useEffect(() => {
    if (streamStatus === 'done') streamReset();
  }, [streamStatus, streamReset]);


  // 关闭时 abort in-flight stream. 已 commit 的 messages + conversationId 保留,
  // 重开是同一会话续话.
  useEffect(() => {
    if (!open) streamAbort();
  }, [open, streamAbort]);

  // 流式时自动滚到底.
  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, partial, streamStatus]);

  const isStreaming = streamStatus === 'streaming';
  const errorTitle = useMemo(() => {
    if (streamError === null) return null;
    const key = streamError as keyof typeof ERROR_COPY;
    return ERROR_COPY[key] ?? null;
  }, [streamError]);

  const handleSend = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || isStreaming) return;

    // 立即把 user message push 到 messages 列表 (optimistic, 配 backend Phase 1
    // commit 一致 — 即使 stream 中断 user msg 也已落 DB, UI 留下).
    // id=负数临时 placeholder; refetch detail 时被替换. 这里不 fetch detail,
    // 留给 ChatPanel 展示交互即时性.
    setMessages((prev) => [
      ...prev,
      { id: -Date.now(), role: 'user', content: trimmed },
    ]);
    setDraft('');

    if (conversationId === null) {
      void streamStart('/llm/conversations', {
        contextKind,
        contextId,
        title,
        userMessage: trimmed,
        intentHint: intent,
      });
    } else {
      void streamStart(`/llm/conversations/${conversationId}/messages`, {
        userMessage: trimmed,
        intentHint: intent,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Cmd+Enter / Ctrl+Enter 发送 (单 Enter 留作换行, 中文输入法兼容).
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const showEmptyState =
    messages.length === 0 && streamStatus === 'idle' && streamError === null;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={LLM_QA_COPY.panelTitle}
    >
      <div className="flex flex-col h-full">
        {/* 意图 chips */}
        <div
          className="flex flex-wrap gap-2 px-7 py-4 border-b border-line shrink-0"
          role="radiogroup"
          aria-label="选择问题意图"
        >
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={intent === opt.value}
              onClick={() => setIntent(opt.value)}
              className={cn(
                'px-3 py-2 rounded-pill text-meta border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                intent === opt.value
                  ? 'bg-ink text-surface border-ink'
                  : 'bg-surface text-ink-3 border-line hover:border-ink-3',
              )}
              data-testid={`chat-intent-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 消息列表 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-7 py-5 space-y-4"
          data-testid="chat-messages"
        >
          {showEmptyState ? (
            <div className="text-center text-ink-3 py-12">
              <p className="text-h-card font-bold text-ink mb-2">
                {LLM_QA_COPY.emptyTitle}
              </p>
              <p className="text-body">{LLM_QA_COPY.emptyHint}</p>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role}>
              {m.content}
            </MessageBubble>
          ))}

          {/* 流式 partial: assistant bubble 包 StreamingText.
              status='done' 时 effect 已把 partial commit 入 messages, 此处不渲. */}
          {isStreaming ? (
            // a11y: MessageBubble 的 `role` 是 React component prop (user|assistant),
            // 不是 HTML ARIA role. plugin 不能区分, 行级 escape.
            // eslint-disable-next-line jsx-a11y/aria-role
            <MessageBubble role="assistant">
              <StreamingText text={partial} isStreaming={isStreaming} />
            </MessageBubble>
          ) : null}

          {/* error frame (含 backend 显式 error 帧 + hook fetch 异常) */}
          {errorTitle !== null ? (
            <div
              className="rounded-card border border-line bg-surface-alt p-4 text-meta"
              role="alert"
              data-testid="chat-error"
            >
              <p className="font-bold text-ink mb-1">{errorTitle.title}</p>
              <p className="text-ink-3">{errorTitle.description}</p>
            </div>
          ) : null}
        </div>

        {/* 输入区 */}
        <div className="border-t border-line px-7 py-4 shrink-0 bg-surface">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={LLM_QA_COPY.inputPlaceholder}
            aria-label={LLM_QA_COPY.inputPlaceholder}
            rows={3}
            className={cn(
              'w-full rounded-card border border-line bg-surface px-3 py-2',
              'text-body text-ink placeholder:text-ink-3 resize-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
            disabled={isStreaming}
            data-testid="chat-input"
          />
          <div className="flex items-center justify-between mt-3 gap-3">
            <span className="text-meta text-ink-3">
              Cmd/Ctrl + Enter 发送
            </span>
            {isStreaming ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => streamAbort()}
                data-testid="chat-stop"
              >
                <StopIcon className="w-4 h-4 mr-1" />
                {LLM_QA_COPY.stop}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={draft.trim().length === 0}
                data-testid="chat-send"
              >
                <SendIcon className="w-4 h-4 mr-1" />
                {LLM_QA_COPY.send}
              </Button>
            )}
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
