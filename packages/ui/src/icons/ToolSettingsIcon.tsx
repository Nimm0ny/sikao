import type { IconProps } from './types';

/**
 * 设置 — gear (sun-rays).
 * Tool 命名 alias, path 与已有 SettingsIcon 近似 (rays 方向小调整以匹配 spec).
 */
export function ToolSettingsIcon({ size = 18, className }: IconProps) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7L5 5" />
    </svg>
  );
}
