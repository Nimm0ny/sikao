import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: ProgressBar gains `variant: 'simple' | 'chunky' | 'ticks'`
// per element/preview/progress.html.
//   - simple (default): 现有单一 fill 条（brand-50 track + brand fill）。
//   - chunky: 分段 N 块（"每块代表一道题"），done / now / left 三态。
//     caller 传 `segments={count}` + `current={index}` 决定哪块是 now。
//   - ticks: hairline 12px rail + 25/50/75 刻度线 + 下方 0/25/50/75/100 scale。
//
// Dumb：不维护状态。caller 给 value / max / segments。

export type ProgressVariant = 'simple' | 'chunky' | 'ticks';

export interface ProgressBarProps {
  readonly value: number;
  readonly max?: number;
  /** Only applies to simple / ticks. */
  readonly size?: 'sm' | 'md';
  readonly variant?: ProgressVariant;
  /** Required when variant='chunky'. 总段数（每段代表一个单位）。 */
  readonly segments?: number;
  /** chunky-only. 当前 segment 的 0-based 索引，视觉高亮为 "now"。 */
  readonly currentSegment?: number;
  readonly ariaLabel?: string;
  readonly className?: string;
}

const SIZE: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

function clampRatio(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  const ratio = value / max;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

function Simple({
  value,
  max,
  size,
  ariaLabel,
  className,
}: Required<Pick<ProgressBarProps, 'value' | 'max' | 'size'>> &
  Pick<ProgressBarProps, 'ariaLabel' | 'className'>) {
  const ratio = clampRatio(value, max);
  const percent = Math.round(ratio * 100);
  return (
    <div
      className={cn('w-full rounded-pill bg-paper-2 overflow-hidden', SIZE[size], className)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className="h-full bg-ink transition-[width] duration-slow ease-motion"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function Chunky({
  segments,
  currentSegment,
  value,
  ariaLabel,
  className,
}: {
  readonly segments: number;
  readonly currentSegment: number | undefined;
  readonly value: number;
  readonly ariaLabel: string | undefined;
  readonly className: string | undefined;
}) {
  if (segments <= 0 || !Number.isFinite(segments)) {
    return null;
  }
  const done = Math.max(0, Math.min(segments, Math.round(value)));
  return (
    <div
      className={cn('flex gap-1 h-[26px]', className)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={segments}
    >
      {Array.from({ length: segments }, (_, idx) => {
        const isNow = currentSegment === idx;
        const isDone = idx < done && !isNow;
        return (
          <span
            key={idx}
            aria-hidden="true"
            className={cn(
              'flex-1 border',
              isDone && 'bg-ink border-ink',
              isNow && 'bg-accent border-accent',
              !isDone && !isNow && 'bg-surface border-line',
            )}
          />
        );
      })}
    </div>
  );
}

function Ticks({
  value,
  max,
  ariaLabel,
  className,
}: {
  readonly value: number;
  readonly max: number;
  readonly ariaLabel: string | undefined;
  readonly className: string | undefined;
}) {
  const ratio = clampRatio(value, max);
  const percent = Math.round(ratio * 100);
  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative h-3 bg-line"
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-slow ease-motion"
          style={{ width: `${percent}%` }}
        />
        {/* 25 / 50 / 75 三条 hairline 刻度 */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-y-1 inset-x-0">
          <span className="absolute inset-y-0 w-px bg-surface" style={{ left: '25%' }} />
          <span className="absolute inset-y-0 w-px bg-surface" style={{ left: '50%' }} />
          <span className="absolute inset-y-0 w-px bg-surface" style={{ left: '75%' }} />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-tiny font-mono tracking-wider text-ink-4">
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'simple',
  segments,
  currentSegment,
  ariaLabel,
  className,
}: ProgressBarProps) {
  if (variant === 'chunky') {
    // segments 是必需的；没传就 no-op 渲染 null（fail-fast 不合适 —— 属 UI 防御）
    if (segments == null) return null;
    return (
      <Chunky
        segments={segments}
        currentSegment={currentSegment}
        value={value}
        ariaLabel={ariaLabel}
        className={className}
      />
    );
  }
  if (variant === 'ticks') {
    return <Ticks value={value} max={max} ariaLabel={ariaLabel} className={className} />;
  }
  return (
    <Simple
      value={value}
      max={max}
      size={size}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
