// StreamingText — Slice 1b dumb stream-aware text renderer.
//
// 三态:
//   1. text='' + isStreaming=true  → 占位 "正在整理回答…" + 灰色脉冲 (chunk
//      还没到, 给用户反馈)
//   2. text!='' + isStreaming=true → 显示 text + 末尾 ▍ 闪烁光标 (chunk 在流)
//   3. isStreaming=false           → 显示 text 不带光标 (final state)
//
// MessageBubble 套外层. StreamingText 只管文本展示 / 光标 / 占位; 不调 API.
//
// aria-live='polite' 让 screen reader 在流式更新时朗读差量, 不打断当前发音.

import { cn } from '@sikao/shared-utils';
import { LLM_QA_COPY } from '@/lib/ui-copy';

export interface StreamingTextProps {
  readonly text: string;
  readonly isStreaming: boolean;
  readonly className?: string;
}

export function StreamingText({ text, isStreaming, className }: StreamingTextProps) {
  const isEmpty = text.length === 0;

  if (isEmpty && isStreaming) {
    return (
      <span
        className={cn('text-ink-3', className)}
        aria-live="polite"
        data-testid="streaming-thinking"
      >
        {LLM_QA_COPY.thinking}
      </span>
    );
  }

  return (
    <span
      className={className}
      aria-live={isStreaming ? 'polite' : undefined}
      data-testid={isStreaming ? 'streaming-active' : 'streaming-final'}
    >
      {text}
      {isStreaming ? (
        <span
          className="inline-block ml-1 align-baseline animate-pulse text-ink-3"
          aria-hidden="true"
        >
          ▍
        </span>
      ) : null}
    </span>
  );
}
