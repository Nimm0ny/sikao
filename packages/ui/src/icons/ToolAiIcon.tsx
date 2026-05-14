import type { IconProps } from './types';

/** AI 解析 — 4-point spark + small spark. */
export function ToolAiIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2zM18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}
