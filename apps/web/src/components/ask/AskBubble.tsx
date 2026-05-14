import { cn } from '@sikao/shared-utils';
import type { AskMessage } from '@sikao/domain/llm/useAskSession';

/**
 * AskBubble — AskDrawer 单条消息气泡 (PR10, 2026-05-13).
 *
 * SSOT: docs/design/Mobile and Tablet Pack New.html M3 ask sheet
 * (.bubble-user / .bubble-ai). 全走 token (无 hardcode hex / px).
 *
 * 双角色:
 *   - user: 右对齐, ink bg + paper text, ml-auto
 *   - assistant: 左对齐, paper-deep bg + ink text, border-l ink
 *
 * 不内嵌入 markdown / DOMPurify — 当前 content 是 plain text (LLM
 * streaming 接入后再升级到 sanitized HTML).
 *
 * Dumb by contract (frontend/CLAUDE.md §2.2): pure props.
 */

export interface AskBubbleProps {
  readonly message: AskMessage;
}

export function AskBubble({ message }: AskBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
        'mb-3',
      )}
      data-testid={`ask-bubble-${message.role}`}
    >
      <p
        className={cn(
          'font-serif text-sm leading-relaxed m-0 px-3 py-2 max-w-[88%]',
          'rounded-card whitespace-pre-wrap break-words',
          isUser
            ? 'bg-ink text-paper-1 ml-auto'
            : 'bg-surface-alt text-ink border-l-2 border-ink',
        )}
      >
        {message.content}
      </p>
    </div>
  );
}
