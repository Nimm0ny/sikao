import { useMemo } from 'react';
import {
  COMMON_STATUS_COLORS,
  COMPOSITE_SIZE_PX,
  compositeNumberFontSize,
  type CommonStatus,
  type CompositeSize,
} from './_shared';

// SIKAO 复合 icon — 题号方 (NumberSquare).
//
// SSOT: design/SIKAO/icon-spec/composite-icons-spec.md §B.
// 与 NumberCircle 完全对偶: 5 状态语义一致, 仅外形从 circle 切到 rect rx=4
// (var(--r-tiny) 等效). 切换通过 Tweaks 面板 option-style="square".

export interface NumberSquareProps {
  readonly number: number | string;
  readonly status: CommonStatus;
  readonly size?: CompositeSize;
  readonly current?: boolean;
  readonly onClick?: () => void;
  readonly ariaLabel: string;
}

export function NumberSquare({
  number,
  status,
  size = 'sm',
  current = false,
  onClick,
  ariaLabel,
}: NumberSquareProps) {
  const px = COMPOSITE_SIZE_PX[size];
  const colors = COMMON_STATUS_COLORS[status];
  const fontSize = useMemo(
    () => compositeNumberFontSize(number, px),
    [number, px],
  );

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {colors.outerFill !== 'none' ? (
        <rect x="1" y="1" width="22" height="22" rx="4" fill={colors.outerFill} />
      ) : null}
      {colors.outerStroke !== 'none' ? (
        <rect
          x="1"
          y="1"
          width="22"
          height="22"
          rx="4"
          stroke={colors.outerStroke}
          strokeWidth="1.4"
          fill="none"
        />
      ) : null}
      {current ? (
        <rect
          x="0.5"
          y="0.5"
          width="23"
          height="23"
          rx="4.5"
          stroke="var(--accent-1)"
          strokeWidth="0.6"
          strokeOpacity="0.3"
          fill="none"
        />
      ) : null}
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={fontSize}
        fill={colors.numberFill}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {number}
      </text>
    </svg>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-status={status}
        style={{
          width: px,
          height: px,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {svg}
      </button>
    );
  }

  return (
    <span role="img" aria-label={ariaLabel} data-status={status}>
      {svg}
    </span>
  );
}
