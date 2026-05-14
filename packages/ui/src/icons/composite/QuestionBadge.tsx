import { cn } from '@sikao/shared-utils';

// SIKAO 复合 icon — 申论问题编号 Q1 ... Q4 (QuestionBadge).
//
// SSOT: design/SIKAO/icon-spec/composite-icons-spec.md §D.
// 4 状态: locked / pending / writing / submitted. submitted 内联一个 ✓ check
// SVG (装饰), locked 内联一个 lock SVG. 数字字数走 mono + tabular-nums.
//
// 与 MaterialBadge 同样走 HTML + 局部 SVG 渲染 (动态宽度 grid 下 SVG <text>
// 不可靠).

import './q-badge.css';

export type QuestionStatus = 'locked' | 'pending' | 'writing' | 'submitted';

export interface QuestionBadgeProps {
  readonly index: number;
  readonly status: QuestionStatus;
  readonly current?: number;
  readonly required?: number;
  readonly onClick?: () => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

function metaText(
  current: number | undefined,
  required: number | undefined,
): string | null {
  // 调用方提供 current/required 时显示字数. 否则不渲染 meta 行 (e.g. locked
  // 状态 + 调用方未传字数 → 仅显示 lock + Q4).
  // required=0 (无字数要求) 显示 "M 字" 而非 "M/0", 避免 0 分母歧义.
  if (current === undefined || required === undefined) return null;
  if (required > 0) return `${current}/${required}`;
  return `${current} 字`;
}

export function QuestionBadge({
  status,
  current,
  required,
  onClick,
  ariaLabel,
  className,
}: QuestionBadgeProps) {
  const meta = metaText(current, required);
  const isLocked = status === 'locked';
  const isSubmitted = status === 'submitted';
  const progress =
    current !== undefined && required !== undefined && required > 0
      ? Math.min(1, current / required)
      : 0;
  return (
    <button
      type="button"
      className={cn('q-badge', className)}
      data-status={status}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={isLocked}
    >
      <svg
        viewBox="0 0 32 20"
        width="32"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isLocked ? (
          <>
            <rect x="9" y="9" width="14" height="8" rx="1.5" />
            <path d="M12 9V7a4 4 0 0 1 8 0v2" />
          </>
        ) : isSubmitted ? (
          <path d="M8 10.5l4.5 4.5L24 5" />
        ) : (
          <>
            <circle cx="10" cy="10" r="5" />
            <path d="M18 6h6M18 10h5M18 14h4" />
          </>
        )}
        {meta !== null ? (
          <>
            <path d="M5 18h22" opacity="0.28" />
            <path d="M5 18h22" pathLength={1} strokeDasharray={`${progress} 1`} />
          </>
        ) : null}
      </svg>
    </button>
  );
}
