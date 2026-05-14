import type { IconProps } from './types';

/** Empty inbox state. */
export function InboxIcon({ size = 18, className }: IconProps) {
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
      <path d="M4 13 6.5 5.5h11L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V13Z" />
      <path d="M4 13h5l1.5 2h3L15 13h5" />
    </svg>
  );
}
