import { type ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';

/**
 * SIKAO Wave 4 Phase 2D · SprintCard — 考前冲刺. paper 底 1px rule, D-30 前禁态.
 *
 * 设计 SSOT `.sprint-card`. 3 行 mono 指标 (金句池 / 方法论卡片 / 建议每日).
 *
 * Dumb: caller 传 daysToExam + threshold, 内部据此切换 disabled UI.
 */

export interface SprintCardProps {
  readonly daysToExam: number;
  readonly threshold?: number;
  readonly highFreqQuoteCount: number;
  readonly methodCardCount: number;
  readonly dailySuggestion: number;
  readonly onStart?: () => void;
  readonly testId?: string;
}

const DEFAULT_THRESHOLD = 30;

export function SprintCard({
  daysToExam,
  threshold = DEFAULT_THRESHOLD,
  highFreqQuoteCount,
  methodCardCount,
  dailySuggestion,
  onStart,
  testId,
}: SprintCardProps): ReactElement {
  const disabled = daysToExam > threshold;
  return (
    <section
      data-testid={testId ?? 'sprint-card'}
      data-disabled={disabled || undefined}
      className={cn(
        'bg-surface border border-line rounded-card p-5',
        'flex flex-col gap-3',
      )}
    >
      <h4 className="m-0 font-serif text-base font-semibold text-ink">
        考前冲刺池
      </h4>
      <p className="text-xs leading-relaxed text-ink-3 m-0">
        距离国考 <span className="font-mono tabular-nums">{daysToExam}</span> 天{disabled ? ` · D-${threshold} 后激活` : ' · 已开放'}
      </p>
      <div className="flex flex-col gap-2">
        <SprintRow label="高频金句池" value={highFreqQuoteCount} unit="条" />
        <SprintRow label="方法论卡片" value={methodCardCount} unit="张" />
        <SprintRow label="建议每日复习" value={dailySuggestion} unit="张" />
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        data-testid="sprint-card-start"
        className={cn(
          'mt-1 inline-flex items-center justify-center px-3 py-2',
          'font-mono text-tiny tracking-wider uppercase rounded-tiny',
          'transition-colors duration-fast ease-motion',
          disabled
            ? 'bg-surface-alt text-ink-4 cursor-not-allowed border border-line'
            : 'bg-ink text-white hover:brightness-95 cursor-pointer border border-transparent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50 focus-visible:ring-offset-2',
        )}
      >
        {disabled ? `D-${threshold} 后激活` : '开始冲刺'}
      </button>
    </section>
  );
}

function SprintRow({
  label,
  value,
  unit,
}: {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
}): ReactElement {
  return (
    <div className="flex justify-between items-baseline font-mono text-tiny tracking-loose text-ink-3">
      <span>{label}</span>
      <span className="text-ink">
        <span className="font-serif text-sm font-semibold tabular-nums">
          {value}
        </span>
        <span className="ml-1 text-ink-4">{unit}</span>
      </span>
    </div>
  );
}
