import type { IconProps } from './types';

export function WarningIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 4l9 16H3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}
