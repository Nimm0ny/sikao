import type { IconProps } from './types';

/** 下载 — arrow-down + tray. */
export function ToolDownloadIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 3v12M7 11l5 4 5-4M4 20h16" />
    </svg>
  );
}
