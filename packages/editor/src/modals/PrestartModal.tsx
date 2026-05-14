import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircleIcon, ClockIcon, ToolEyeIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import type { Question } from '@sikao/domain/shenlun/types';
import { getWordLimitText } from '@sikao/answer-engine/word-limit/wordLimits';

interface Props {
  question: Question;
  onStart: () => void;
  onPreview: () => void;
}

const COUNTDOWN_SEC = 3;
const SESSION_KEY = 'exam-v2-prestart-seen';

// PrestartModal — F6.1. 3s read countdown gate before the user can start
// the exam clock. We persist a session flag so navigating away + back
// doesn't force them to wait again.

function readSeen(): boolean {
  // Lazy lookup wrapped in try/catch — Safari private mode throws on getItem.
  // Fail-open (treat as "not seen") so we still gate the user the first time.
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function PrestartModal({ question, onStart, onPreview }: Props) {
  const [count, setCount] = useState(() => (readSeen() ? 0 : COUNTDOWN_SEC));
  const titleId = useId();
  const previewBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (count <= 0) return;
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  // Move focus into the modal on mount so keyboard users land inside the
  // dialog. Preview is the safer initial focus (Start is destructive — it
  // begins the exam clock).
  useEffect(() => {
    previewBtnRef.current?.focus();
  }, []);

  // ESC = preview (non-destructive escape hatch). PrestartModal owns its own
  // ESC instead of relying on ExamShell's global handler so the listener is
  // scoped to the dialog lifetime.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onPreview();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPreview]);

  const handleStart = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // noop — sessionStorage unavailable (Safari private mode etc.)
    }
    onStart();
  };

  const minutes = Math.round(question.durationSec / 60);
  const wordLimitText = getWordLimitText(question);

  return (
    <div
      className={cn(
        'absolute inset-0 z-50',
        'bg-ink/40 backdrop-blur-[4px]', /* hardcode-allow: 4px backdrop blur tuned to design v2 */
        'flex items-center justify-center',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="exam-prestart-modal"
    >
      <div className="bg-surface rounded-card-lg w-[460px] p-7 shadow-pop"> {/* hardcode-allow: 460px modal width is content-driven, dimensions unrestricted by lint */}
        <div className="text-tiny text-accent font-semibold tracking-wider mb-1">
          开考前请阅读 · {question.no}（{question.kind}）
        </div>
        <div id={titleId} className="text-xl font-bold text-ink mb-4">
          {question.title}
        </div>
        <div
          className={cn(
            'text-sm text-ink-3 leading-relaxed mb-4 p-4',
            'bg-surface-alt rounded-tiny border border-line',
          )}
        >
          {question.body}
        </div>
        <ul className="m-0 pl-4 text-sm text-ink-3 list-disc">
          {question.requirements.map((r) => (
            <li key={r} className="leading-loose">
              {r}
            </li>
          ))}
          <li className="leading-loose">
            建议用时约 {minutes} 分钟 · {wordLimitText}
          </li>
        </ul>
        <div
          className={cn(
            'mt-4 px-4 py-3 rounded-tiny border',
            'bg-warn-bg border-warn/40 text-xs text-warn leading-relaxed',
          )}
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircleIcon className="w-3.5 h-3.5" />
            <span>进入考场后倒计时开始,时间到自动交卷。建议安静环境作答。</span>
          </span>
        </div>
        <div className="flex gap-3 mt-5">
          {/* svg-only-allow: modal secondary action needs visible text in dialog footer */}
          <button
            ref={previewBtnRef}
            type="button"
            onClick={onPreview}
            className={cn(
              'flex-1 px-4 py-3 bg-surface border border-line text-ink-3 rounded-card text-sm font-semibold cursor-pointer',
              'transition-colors duration-base hover:bg-surface-alt',
            )}
            data-testid="exam-prestart-preview-btn"
          >
            <ToolEyeIcon className="w-4 h-4" />
            先浏览材料
          </button>
          {/* svg-only-allow: modal primary action needs visible text in dialog footer */}
          <button
            type="button"
            onClick={handleStart}
            disabled={count > 0}
            className={cn(
              'flex-[2] px-4 py-3 rounded-card text-sm font-bold',
              count > 0
                ? 'bg-line-3 text-surface cursor-not-allowed'
                : 'bg-ink text-surface cursor-pointer',
            )}
            data-testid="exam-prestart-start-btn"
          >
            <ClockIcon className="w-4 h-4" />
            {count > 0 ? `请阅读… ${count}s` : '我已阅读 · 开始作答'}
          </button>
        </div>
      </div>
    </div>
  );
}
