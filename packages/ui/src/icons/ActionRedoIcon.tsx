import type { IconProps } from './types';

/** 重做 — corner-up-right + curve. */
export function ActionRedoIcon({ size = 18, className }: IconProps) {
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
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h3" />
    </svg>
  );
}
