import { ChevronRightIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import type { Question } from '@sikao/domain/shenlun/types';
import { getWordLimitText } from '@sikao/answer-engine/word-limit/wordLimits';

interface Props {
  question: Question;
  isCurrent: boolean;
  onSwitch: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// QuestionPeek — popover anchored under the topbar's second row showing
// the previewed question's no / kind / 不少于 X 字 / requirements + body.
// Shown on hover and on click of the 题干 toggle button.

export function QuestionPeek({ question, isCurrent, onSwitch, onMouseEnter, onMouseLeave }: Props) {
  const minutes = Math.round(question.durationSec / 60);
  const wordLimitText = getWordLimitText(question);
  return (
    // a11y: popover hover wrap. mouse hover bridge 让 popover 内能继续 hover 不消失
    // (mouse 移过 gap 时 popover 不 unmount). 内含切到 button 是真正交互入口.
    // 此容器是 mouse-only enhancement (hover popover), 不影响 keyboard / SR.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'absolute left-5 right-5 z-30',
        'bg-surface border border-line rounded-card-lg shadow-pop p-4',
        'exam-fade-slide',
      )}
      style={{ top: 'calc(100% - 4px)' }}
      data-testid="exam-question-peek"
    >
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <span className="text-tiny font-bold text-accent px-2 py-px border border-accent/30 rounded-tiny bg-accent-50">
          {question.no}
        </span>
        <span className="text-tiny text-ink-3">{question.kind}</span>
        <span className="text-tiny text-ink-4">
          · {wordLimitText} · 建议 {minutes} 分钟
        </span>
        <span className="flex-1" />
        {!isCurrent && (
          <button
            type="button"
            onClick={onSwitch}
            aria-label={`切到${question.no}`}
            className="w-7 h-7 bg-ink text-surface rounded-tiny cursor-pointer inline-flex items-center justify-center"
            data-testid="exam-question-peek-switch"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="text-md font-bold text-ink mb-2 font-serif">
        「{question.title}」
      </div>
      <p className="text-sm text-ink-3 leading-relaxed mb-2">{question.body}</p>
      <div className="flex flex-wrap gap-1">
        {question.requirements.map((r) => (
          <span
            key={r}
            className="text-xs text-ink-3 px-2 py-px bg-surface-alt rounded-pill"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
