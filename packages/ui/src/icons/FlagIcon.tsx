import type { IconProps } from './types';

/** 举报 / flag — hairline 描边. 跟 WarningIcon 区别: WarningIcon 是状态提示 (alert),
 *  FlagIcon 是用户主动动作 (上报这条内容). */
export function FlagIcon({ size = 18, className }: IconProps) {
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
      <path d="M5 4v17" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
