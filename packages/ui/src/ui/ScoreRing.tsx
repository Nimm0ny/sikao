import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: matches element/preview/progress.html ring spec.
//   - track: line (hairline gray)
//   - progress: ink (black)
//   - center number: serif italic / 400 weight（Source Serif 4 回退 Songti）
//
// 数学：circumference = 2πr = 2 * 3.14159 * 52 ≈ 326.725. 取 326（和原 demo 一致），
// 按 value/max 得 dashoffset。

export interface ScoreRingProps {
  readonly value: number;
  readonly max?: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly label?: ReactNode;
  readonly sublabel?: ReactNode;
  readonly className?: string;
}

const CIRCLE_RADIUS = 52;
const CIRCUMFERENCE = Math.round(2 * Math.PI * CIRCLE_RADIUS);

function clampRatio(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(max)) return 0;
  const ratio = value / max;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

export function ScoreRing({
  value,
  max = 100,
  size = 144,
  strokeWidth = 10,
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const ratio = clampRatio(value, max);
  const dashOffset = Math.round(CIRCUMFERENCE * (1 - ratio));
  const display = label ?? Math.round(value);
  const fallbackSub = sublabel ?? `满分 ${max}`;
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${value} of ${max}`}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={CIRCLE_RADIUS}
          stroke="var(--line-2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx="60"
          cy="60"
          r={CIRCLE_RADIUS}
          stroke="var(--ink-1)"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* element spec: serif italic 400 weight 大数字，tabular-nums 对齐。 */}
        <div className="font-serif text-4xl italic font-normal tabular-nums text-ink tracking-tight leading-none">
          {display}
        </div>
        <div className="mt-2 text-tiny font-semibold tracking-widest uppercase text-ink-4">
          {fallbackSub}
        </div>
      </div>
    </div>
  );
}
