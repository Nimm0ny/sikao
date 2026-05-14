import { useEffect, useId, useRef } from 'react';
import { PlayIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import { formatTime } from '@sikao/answer-engine/grid-layout/gridLayout';

interface Props {
  written: number;
  remaining: number;
  onResume: () => void;
}

// PausedOverlay — F6.2. Full-screen frosted veil while paused; explicit
// copy that this is a *practice* exam (real ones don't pause).

export function PausedOverlay({ written, remaining, onResume }: Props) {
  const titleId = useId();
  const resumeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeBtnRef.current?.focus();
  }, []);

  // ESC resumes — the veil is non-destructive, escape should be the
  // single-key path back to writing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResume]);

  return (
    <div
      className={cn(
        'absolute inset-0 z-40',
        'bg-surface/95 backdrop-blur-[6px]', /* hardcode-allow: 6px paused backdrop blur tuned to design v2 */
        'flex items-center justify-center flex-col gap-3',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="exam-paused-overlay"
    >
      <div className="text-tiny text-accent font-semibold tracking-wider">练习模式</div>
      <div id={titleId} className="text-2xl font-bold text-ink">
        已暂停
      </div>
      <div className="text-sm text-ink-3 max-w-sm text-center leading-relaxed">
        真实考场不可暂停 — 此处仅练习。已写 {written} 字 · 剩余 {formatTime(remaining)}
      </div>
      {/* svg-only-allow: modal primary action needs visible text in dialog footer */}
      <button
        ref={resumeBtnRef}
        type="button"
        onClick={onResume}
        aria-label="继续答题"
        className="mt-2 px-7 py-3 bg-ink text-surface rounded-card text-sm font-bold cursor-pointer inline-flex items-center gap-2"
        data-testid="exam-paused-resume-btn"
      >
        <PlayIcon className="w-4 h-4" />
        继续答题
      </button>
    </div>
  );
}
