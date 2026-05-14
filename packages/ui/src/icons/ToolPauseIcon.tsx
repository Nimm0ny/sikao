import type { IconProps } from './types';

/** 暂停计时 — Tool 命名 alias, path 比已有 PauseIcon 略向中央收 (9/15 vs 8/16). */
export function ToolPauseIcon({ size = 18, className }: IconProps) {
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
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}
