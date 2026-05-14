import type { IconProps } from './types';

/** 笔记（document w/ folded corner）— 题卡笔记 toggle / 申论 scratch 区。 */
export function NoteIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M15 4v4h4" />
      <path d="M8 11h8M8 14h8M8 17h6" />
    </svg>
  );
}
