import { useEffect } from 'react';
import { StatusDoneIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import type { Question } from '@sikao/domain/shenlun/types';
import { formatTime } from '@sikao/answer-engine/grid-layout/gridLayout';
import {
  getWordLimitTarget,
  hasExceededMaximum,
  hasReachedMinimum,
} from '@sikao/answer-engine/word-limit/wordLimits';

interface Props {
  question: Question;
  index: number;
  written: number;
  elapsed: number;
  active: boolean;
  pinned: boolean;
  celebrating: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onHover: (entered: boolean) => void;
  onCelebrateEnd: () => void;
}

const RING_R = 13;
const RING_C = 2 * Math.PI * RING_R;
const TIME_R = 14;
const TIME_C = 2 * Math.PI * TIME_R;

// QuestionRing — one of the five buttons in the topbar's second row.
// Two SVG rings: the inner stroke is the word-count progress; a thin outer
// arc is the time progress (elapsed vs duration).
// Active state expands the chip with question no / kind / N/M · mm:ss.

export function QuestionRing({
  question,
  index,
  written,
  elapsed,
  active,
  pinned,
  celebrating,
  onSelect,
  onTogglePin,
  onHover,
  onCelebrateEnd,
}: Props) {
  const targetWords = getWordLimitTarget(question);
  const done = hasReachedMinimum(question, written);
  const exceeded = hasExceededMaximum(question, written);
  const wordPct = Math.min(1, written / targetWords);
  const timePct = Math.min(1, elapsed / question.durationSec);

  // 900ms celebrate animation — clear once it's done so the next completion
  // can re-trigger from a fresh state.
  useEffect(() => {
    if (!celebrating) return;
    const id = window.setTimeout(onCelebrateEnd, 900);
    return () => window.clearTimeout(id);
  }, [celebrating, onCelebrateEnd]);

  const ringStroke = exceeded ? 'var(--color-state-err)' : done ? 'var(--exam-success-deep)' : active ? '#93c5fd' : 'var(--color-brand-primary)'; /* hardcode-allow: light-blue ring on dark active chip needs sky-300; not a tokenable scenario */
  const timeStroke = timePct >= 1 ? 'var(--color-state-err)' : timePct >= 0.75 ? 'var(--color-state-warn)' : active ? 'color-mix(in oklch, var(--color-bg-surface), transparent 65%)' : 'var(--color-border-strong)';

  const label = `切到 ${question.no} (${question.kind})${pinned ? ' · 已固定题干' : ''}`;

  return (
    <Tooltip label={`${question.no} · ${question.kind} · 已写 ${written}/${targetWords} · 双击固定题干`}>
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onTogglePin}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'relative shrink-0 h-9 rounded-pill flex items-center gap-2 cursor-pointer font-sans',
        'transition-[background-color,border-color,padding,color] duration-base',
        active ? 'bg-ink text-surface px-3 py-0' : 'bg-surface text-ink-3 border border-line px-1',
        celebrating && !active && 'bg-ok-bg',
        pinned && 'ring-2 ring-accent/60 ring-offset-1 ring-offset-surface',
      )}
      data-testid={`exam-questionring-${index}`}
      aria-current={active ? 'true' : undefined}
      aria-pressed={pinned}
      aria-label={label}
    >
      <span className="relative w-7 h-7 shrink-0" aria-hidden>
        <svg width={30} height={30} viewBox="0 0 30 30" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={15}
            cy={15}
            r={RING_R}
            fill="none"
            stroke={active ? 'rgba(255,255,255,0.18)' : 'var(--bg-tint-2)'} /* hardcode-allow: 18% white track behind active ring; matches design v2 */
            strokeWidth={2.5}
          />
          <circle
            cx={15}
            cy={15}
            r={RING_R}
            fill="none"
            stroke={ringStroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - wordPct)}
            className="exam-ring-stroke"
          />
          {timePct > 0 && (
            <circle
              cx={15}
              cy={15}
              r={TIME_R}
              fill="none"
              stroke={timeStroke}
              strokeWidth={1}
              strokeLinecap="round"
              strokeDasharray={`${TIME_C * timePct} ${TIME_C}`}
              opacity={0.85}
            />
          )}
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-mono tabular-nums',
            'text-[11px] font-bold leading-none', /* hardcode-allow: 11px ring numeral fits 30px circle; tokens jump to 12 (too big) */
            active ? 'text-surface' : exceeded ? 'text-err' : done ? 'text-ok' : 'text-ink',
            celebrating && done && 'exam-check-pop',
          )}
        >
          {done ? (
            <StatusDoneIcon className="w-3 h-3" />
          ) : (
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="3.2" />
              {active ? <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" /> : null}
            </svg>
          )}
        </span>
        {celebrating && (
          <span
            aria-hidden
            className="absolute -inset-1 rounded-pill border-2 border-ok pointer-events-none exam-celebrate-ring"
          />
        )}
      </span>

      {active && (
        <span className="flex flex-col items-start gap-px leading-tight">
          <span className="text-tiny font-bold whitespace-nowrap">
            {question.no} · {question.kind}
          </span>
          <span
            className="text-tiny font-mono tabular-nums opacity-70 whitespace-nowrap"
            data-testid={`exam-questionring-stats-${index}`}
          >
            {written}/{targetWords} · {formatTime(elapsed)}
          </span>
        </span>
      )}
    </button>
    </Tooltip>
  );
}
