import type { IconProps } from './types';

/** Fullscreen toggle — four corner strokes. */
export function ToolFullscreenIcon({ size = 18, className }: IconProps) {
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
      <path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4" />
      <path d="M9 9 4 4M15 9l5-5M9 15l-5 5M15 15l5 5" />
    </svg>
  );
}
