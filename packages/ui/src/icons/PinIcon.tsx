import type { IconProps } from './types';

export function PinIcon({ size = 18, className }: IconProps) {
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
      <path d="M9 3h6l-1 4 4 4-3 3-3-1-3 5-2-2 5-3-1-3 4-3z" />
    </svg>
  );
}
