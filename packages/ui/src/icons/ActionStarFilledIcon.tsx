import type { IconProps } from './types';

/** 收藏 (pressed). filled, currentColor 走 ink/accent. */
export function ActionStarFilledIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l2.6 5.3 5.7.8-4.2 4.1 1 5.7L12 16.7l-5.1 2.7 1-5.7-4.2-4.1 5.7-.8z" />
    </svg>
  );
}
