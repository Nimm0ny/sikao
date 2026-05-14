import type { IconProps } from './types';

/** 答题卡（grid of cells）— 用于练习 toolbar 的答题卡入口。 */
export function AnswerCardIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
    </svg>
  );
}
