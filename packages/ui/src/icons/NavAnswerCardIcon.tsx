import type { IconProps } from './types';

/**
 * 答题卡 trigger — 3×5 cells (rect + 6 dots).
 * 与已有 AnswerCardIcon 不同 path: 此版按 spec inventory svg 抽取, 6 dot pairs.
 */
export function NavAnswerCardIcon({ size = 18, className }: IconProps) {
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
      <rect x="4" y="5" width="16" height="14" rx="1" />
      <path d="M8 9h2M14 9h2M8 12h2M14 12h2M8 15h2M14 15h2" />
    </svg>
  );
}
