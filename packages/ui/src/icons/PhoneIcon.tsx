import type { IconProps } from './types';

export function PhoneIcon({ size = 18, className }: IconProps) {
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
      <path d="M8.5 5.5l1.7 3.6-2 1.2a10.5 10.5 0 0 0 5.5 5.5l1.2-2 3.6 1.7-.6 3.2c-.2.8-.9 1.3-1.7 1.2C9.8 19.3 4.7 14.2 4.1 7.8c-.1-.8.4-1.5 1.2-1.7z" />
    </svg>
  );
}
