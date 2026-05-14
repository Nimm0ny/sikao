// MessageBubble — Slice 1b dumb container.
//
// User / assistant 双态左右气泡. 不处理流式光标或占位 — 那是 StreamingText
// 的职责 (SRP, §4 "类同时管两件事 = 拆"). 不写 store, 不调 API.

import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

export type MessageBubbleRole = 'user' | 'assistant';

export interface MessageBubbleProps {
  readonly role: MessageBubbleRole;
  readonly children: ReactNode;
  readonly className?: string;
}

export function MessageBubble({ role, children, className }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
      data-testid={`message-bubble-${role}`}
    >
      <div
        // ink-first: user 用 brand ink 实色, assistant 走 surface 软底.
        // (深底浅 accent 是合理 dark-accent, 不动. memory feedback_dark_accent_preserve)
        className={cn(
          'max-w-[85%] rounded-card-lg px-4 py-3',
          'text-body whitespace-pre-wrap break-words',
          isUser
            ? 'bg-ink text-surface'
            : 'bg-surface-alt text-ink border border-line',
        )}
      >
        {children}
      </div>
    </div>
  );
}
