import type { IconProps } from './types';

/** Offline network status. */
export function WifiOffIcon({ size = 18, className }: IconProps) {
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
      <path d="M3 3l18 18" />
      <path d="M8.5 8.5a9.5 9.5 0 0 1 7 0" />
      <path d="M5 12a14 14 0 0 1 7-2c1.1 0 2.2.13 3.25.38" />
      <path d="M8.75 15.75A5.8 5.8 0 0 1 12 14.8c.85 0 1.66.18 2.38.5" />
      <path d="M12 19h.01" />
    </svg>
  );
}
