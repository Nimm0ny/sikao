import type { IconProps } from './types';

/** 钉住 clip — push-pin hexagon. ScratchPad 内部. */
export function ToolPinIcon({ size = 18, className }: IconProps) {
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
      <path d="M12 2v8M8 6l4-4 4 4M6 12l-2 4 2 4h12l2-4-2-4z" />
    </svg>
  );
}
