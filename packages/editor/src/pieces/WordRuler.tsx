import { cn } from '@sikao/shared-utils';

interface Props {
  written: number;
  withPunct: number;
  minWords?: number;
  maxWords?: number;
}

// WordRuler — sticky panel below the 田字格. Shows the current 字数 vs the
// target with three colour states (placeholder -> accent -> success) plus a
// progress bar with 200/400/600/800 tick marks for long prompts.

const TICK_STEPS = [200, 400, 600, 800];

export function WordRuler({ written, withPunct, minWords, maxWords }: Props) {
  const targetWords = minWords ?? maxWords;
  if (targetWords === undefined) {
    throw new Error('word ruler word limit missing');
  }
  const hasMinimum = minWords !== undefined;
  const reached = hasMinimum && written >= minWords;
  const exceeded = maxWords !== undefined && written > maxWords;
  const ratio = Math.min(1, written / targetWords);
  const tone = exceeded
    ? 'text-err'
    : reached
      ? 'text-ok'
      : written >= targetWords * 0.6
        ? 'text-accent'
        : 'text-ink-4';
  const fillTone = exceeded
    ? 'bg-err'
    : reached
      ? 'bg-ok'
      : written >= targetWords * 0.6
        ? 'bg-accent'
        : 'bg-line-3';
  const statusText = hasMinimum
    ? reached
      ? '✓ 已达字数要求'
      : `还差 ${minWords - written} 字`
    : exceeded
      ? `超出 ${written - maxWords} 字`
      : `上限 ${maxWords} 字`;

  return (
    <div
      className="bg-surface border border-line rounded-card-lg p-4"
      data-testid="exam-word-ruler"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-2xl font-bold font-mono tabular-nums',
              tone,
            )}
            data-testid="exam-word-ruler-count"
          >
            {written}
          </span>
          <span className="text-xs text-ink-4">
            正文 · 含标点 {withPunct}
          </span>
        </div>
        <span className="text-xs text-ink-3">
          {statusText}
        </span>
      </div>
      <div className="relative h-2 bg-surface-alt rounded-pill mt-1">
        <div
          className={cn('absolute left-0 top-0 bottom-0 rounded-pill transition-all duration-base', fillTone)}
          style={{ width: `${ratio * 100}%` }}
          data-testid="exam-word-ruler-fill"
        />
        {TICK_STEPS.filter((m) => m < targetWords).map((mark) => {
          const left = (mark / targetWords) * 100;
          const stepReached = written >= mark;
          return (
            <div
              key={mark}
              className="absolute -top-px"
              style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
              aria-hidden
            >
              <div
                className={cn(
                  'w-px h-3',
                  stepReached ? 'bg-surface' : 'bg-line-3',
                )}
              />
              <div
                className={cn(
                  'absolute top-3 left-1/2 -translate-x-1/2',
                  'text-tiny font-mono font-semibold whitespace-nowrap',
                  stepReached ? tone : 'text-ink-4',
                )}
              >
                {mark}
              </div>
            </div>
          );
        })}
        <div
          className={cn(
            'absolute right-0 top-3 text-tiny font-mono font-bold',
            tone,
          )}
          aria-hidden
        >
          {targetWords}
        </div>
      </div>
      <div className="h-3" aria-hidden />
    </div>
  );
}
