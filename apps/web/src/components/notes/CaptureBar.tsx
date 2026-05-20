import { useEffect, useState, type ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';
import type { NoteType } from '@sikao/api-client/queries/notebookQueries';
import { NOTES_COPY } from '@/lib/ui-copy';

/**
 * SIKAO Wave 4 Phase 2D · CaptureBar — top sticky 快速捕获.
 *
 * 设计 SSOT `.cap-bar` + 简化版: NotesHome 顶部 sticky 快速捕获条 (不是浮条 A
 * 选区那一套, 浮条 A 推 Phase 5 集成入口). 本 sticky 版本:
 *   - 桌面 1 行: input + type-pick mini + "添加 (⌘N)" CTA
 *   - 用户按 Cmd+N (Ctrl+N) 自动 focus input
 *
 * Hotkey: Cmd+N (Mac) / Ctrl+N (Win) → focus input + (option) auto-submit.
 * keypress capture phase 拦截 (window 级 keydown). preventDefault 防浏览器
 * 默认 "新窗口" 行为.
 *
 * Dumb: caller 传 onSubmit(text, type, sourceDomain) → POST /notebook/notes.
 */

export interface CaptureBarProps {
  readonly onSubmit: (input: CaptureInput) => void;
  readonly testId?: string;
  readonly isSubmitting?: boolean;
}

export interface CaptureInput {
  readonly text: string;
  readonly type: NoteType;
  readonly sourceDomain: 'xingce' | 'essay';
}

const TYPE_OPTS: ReadonlyArray<{ value: NoteType; label: string }> = [
  { value: 'quote', label: '金句' },
  { value: 'method', label: '方法' },
  { value: 'reflect', label: '反思' },
  { value: 'material', label: '素材' },
];

export function CaptureBar({
  onSubmit,
  testId,
  isSubmitting = false,
}: CaptureBarProps): ReactElement {
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('quote');
  const [sourceDomain, setSourceDomain] = useState<'xingce' | 'essay'>('essay');

  // Cmd+N / Ctrl+N — focus input. 不绑 default-action submit, 用户可继续输入.
  // 用 data-testid 找 input element 而不是 useRef — caller 也可外部 trigger.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const isMacShortcut = e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'n';
      const isWinShortcut = e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n';
      if (isMacShortcut || isWinShortcut) {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="capture-bar-input"]',
        );
        if (input !== null) {
          e.preventDefault();
          input.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    onSubmit({ text: trimmed, type, sourceDomain });
    setText('');
  };

  return (
    <section
      data-testid={testId ?? 'capture-bar'}
      className={cn(
        'sticky top-0 z-10 bg-surface border border-line rounded-card',
        'flex flex-wrap items-center gap-3 p-3',
      )}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        data-testid="capture-bar-input"
        placeholder={`${NOTES_COPY.captureBarPlaceholder} · 金句 / 方法 / 反思 / 素材`}
        aria-label={NOTES_COPY.captureBarAriaLabel}
        className={cn(
          'flex-1 min-w-[200px] px-3 py-2 bg-transparent border border-line rounded-tiny',
          'font-sans text-sm text-ink placeholder:text-ink-4',
          'focus-visible:outline-none focus-visible:border-ink',
        )}
      />

      <div
        role="radiogroup"
        aria-label={NOTES_COPY.captureBarTypeAriaLabel}
        className="flex items-center gap-1"
      >
        {TYPE_OPTS.map((opt) => {
          const selected = type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`capture-bar-type-${opt.value}`}
              onClick={() => setType(opt.value)}
              className={cn(
                'px-3 py-2 font-mono text-tiny tracking-wider uppercase rounded-tiny',
                'transition-colors duration-fast ease-motion border',
                selected
                  ? 'bg-ink text-white border-ink'
                  : 'bg-transparent text-ink-3 border-line hover:border-line-3 hover:text-ink',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <select
        value={sourceDomain}
        onChange={(e) =>
          setSourceDomain(e.target.value === 'xingce' ? 'xingce' : 'essay')
        }
        data-testid="capture-bar-source-domain"
        aria-label={NOTES_COPY.captureDomainAriaLabel}
        className={cn(
          'px-3 py-2 bg-transparent border border-line rounded-tiny',
          'font-mono text-tiny tracking-loose text-ink-3',
          'focus-visible:outline-none focus-visible:border-ink',
        )}
      >
        <option value="essay">申论</option>
        <option value="xingce">行测</option>
      </select>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        data-testid="capture-bar-submit"
        className={cn(
          'px-3 py-2 font-mono text-tiny tracking-wider uppercase rounded-tiny',
          'bg-ink text-white border border-transparent',
          'transition-colors duration-fast ease-motion',
          'hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
        )}
      >
        添加 <kbd className="ml-1 font-mono opacity-70">⌘N</kbd>
      </button>
    </section>
  );
}
