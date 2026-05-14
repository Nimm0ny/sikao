import { Chip } from '@sikao/ui/ui/Chip';
import { LLM_QA_COPY } from '@/lib/ui-copy';

/**
 * PromptChips — AskDrawer 推荐 prompt 横排 (PR10, 2026-05-13).
 *
 * SSOT: docs/design/Mobile and Tablet Pack New.html M3 .prompt-chips
 * + docs/design/handoff/Mobile and Tablet · Handoff.md §6.
 *
 * 复用 Chip primitive (PR3 ship, Frontend Style Guide v1) — 不创新.
 * 不可点击态: disabled=true 时 Chip 自带 opacity-50 + cursor-not-allowed.
 *
 * Prompt 文案 SSOT: lib/ui-copy/system.ts LLM_QA_COPY.askPrompts —
 * caller 不内联中文 (frontend/CLAUDE.md §3.7 ui-copy-ssot 规范).
 *
 * Dumb by contract: 无 store / fetch; onPick 由 caller 处理.
 */

export interface PromptChipsProps {
  readonly disabled?: boolean;
  readonly onPick: (prompt: string) => void;
}

export function PromptChips({ disabled = false, onPick }: PromptChipsProps) {
  return (
    <div
      className="flex flex-wrap gap-2 mb-3"
      data-testid="ask-prompt-chips"
      role="list"
      aria-label="推荐问题"
    >
      {LLM_QA_COPY.askPrompts.map((prompt) => (
        <Chip
          key={prompt}
          size="md"
          disabled={disabled}
          onClick={() => onPick(prompt)}
          aria-label={`使用提示: ${prompt}`}
        >
          {prompt}
        </Chip>
      ))}
    </div>
  );
}
