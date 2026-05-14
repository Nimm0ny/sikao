import type { IconProps } from './types';

/** Decrease typography size — small "A" + minus glyph. */
export function FontSizeMinusIcon({ size = 18, className }: IconProps) {
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
      {/* small "A" — apex 8, base 5..11, crossbar 6.5..9.5 */}
      <path d="M5 17 L8 9 L11 17" />
      <path d="M6.5 14 L9.5 14" />
      {/* minus on the right */}
      <path d="M14 13 L20 13" />
    </svg>
  );
}
