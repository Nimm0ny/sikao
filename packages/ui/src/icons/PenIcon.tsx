import type { IconProps } from './types';

export function PenIcon({ size = 18, className }: IconProps) {
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
      <path d="M4 20l4.2-1 10.5-10.5-3.2-3.2L5 15.8z" />
      <path d="M13.8 7l3.2 3.2" />
    </svg>
  );
}
