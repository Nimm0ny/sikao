import type { IconProps } from './types';

/** 向 AI 提问 — chat bubble with tail. */
export function ToolChatIcon({ size = 18, className }: IconProps) {
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
      <path d="M4 5h16v11H10l-4 4v-4H4z" />
    </svg>
  );
}
