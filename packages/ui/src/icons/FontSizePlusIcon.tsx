import type { IconProps } from './types';

/** Increase typography size — large "A" + plus glyph. */
export function FontSizePlusIcon({ size = 18, className }: IconProps) {
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
      {/* large "A" — apex 7, base 3..11, crossbar 4.5..9.5 */}
      <path d="M3 19 L7 5 L11 19" />
      <path d="M4.5 14 L9.5 14" />
      {/* plus on the right */}
      <path d="M17 10 L17 16" />
      <path d="M14 13 L20 13" />
    </svg>
  );
}
