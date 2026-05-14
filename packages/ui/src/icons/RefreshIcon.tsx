import type { IconProps } from './types';

/** Retry or refresh action. */
export function RefreshIcon({ size = 18, className }: IconProps) {
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
      <path d="M20 11a8 8 0 0 0-14.2-5" />
      <path d="M6 4.5v4h4" />
      <path d="M4 13a8 8 0 0 0 14.2 5" />
      <path d="M18 19.5v-4h-4" />
    </svg>
  );
}
