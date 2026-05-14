import type { IconProps } from './types';

/** AI spark (4-point star) — 区分日常 chat，仅用于 AI 智能动作。 */
export function AiIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 3l2.1 4.7L19 9.8l-4.9 2.1L12 17l-2.1-5.1L5 9.8l4.9-2.1z" />
    </svg>
  );
}
