import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial stat card per spec.
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .stat-card (line ~445-471).
//   .stat-card {
//     background: var(--paper-1);
//     border: 1px solid var(--line-2);
//     border-radius: var(--r-card);  /* 10px */
//     padding: 16px 18px;
//   }
//   .stat-card .label {
//     font-family: serif italic; color: var(--ink-3); font-size: 12px;
//     margin-bottom: 6px;
//   }
//   .stat-card .v {
//     font-family: serif 600 32px; color: var(--ink-1);
//     font-variant-numeric: tabular-nums; letter-spacing: -.01em; line-height: 1;
//   }
//   .stat-card .v .unit { serif italic 400 14px; color: var(--ink-3); margin-left: 3px; }
//   .stat-card .delta { margin-top: 6px; serif italic 11px; }
//   .stat-card .delta.up   { color: var(--ok); }
//   .stat-card .delta.down { color: var(--err); }
//   (flat 无颜色规则, 走 ink-3 占位.)
//
// 跟 StatCallout 解耦:
//   - StatCallout = SIKAO Phase 5.2 editorial 卡 (sparkline + trailing + description + size md/lg)
//   - StatCard    = Style Guide v1 干净规范 stat tile (label / value / unit / delta, size sm/md)
// 两者并存; 现有 view 引用 StatCallout 不动, 新代码用 StatCard.
//
// italic 例外: serif italic 数字 / serif italic 11px label 是规范 §5 显式调性
// (CLAUDE.md §4 italic 政策第 1 条 serif 数字 design signature 例外).
// 内容默认 ASCII / 数字 / 短英文 label; CJK 内容需 CJK-safe 走 font-serif 不带 italic.

export type StatDeltaDirection = 'up' | 'down' | 'flat';

export interface StatDelta {
  readonly value: string;
  readonly direction: StatDeltaDirection;
}

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  readonly label: ReactNode;
  readonly value: number | string;
  readonly unit?: ReactNode;
  readonly delta?: StatDelta;
  readonly size?: 'sm' | 'md';
}

const SIZE_PADDING: Record<NonNullable<StatCardProps['size']>, string> = {
  // 规范 §5: md padding 16px 18px / sm 紧凑一档. Tailwind 步进无 4.5 — md y/x 等用 sp 整数对齐.
  sm: 'px-3 py-2',
  md: 'px-4 py-4',
};

const SIZE_VALUE: Record<NonNullable<StatCardProps['size']>, string> = {
  sm: 'text-2xl',
  md: 'text-h1', // 32px == --t-h1
};

const DELTA_TONE: Record<StatDeltaDirection, string> = {
  up: 'text-ok',
  down: 'text-err',
  flat: 'text-ink-3',
};

const DELTA_GLYPH: Record<StatDeltaDirection, string> = {
  // ASCII 符号属于 CLAUDE.md §4 italic 政策第 2 条例外 (editorial 排版传统).
  up: '↑',
  down: '↓',
  flat: '—',
};

export function StatCard({
  label,
  value,
  unit,
  delta,
  size = 'md',
  className,
  ...rest
}: StatCardProps): ReactNode {
  return (
    <div
      className={cn(
        'bg-paper-1 border border-line-2 rounded-card',
        SIZE_PADDING[size],
        className,
      )}
      {...rest}
    >
      {/* label — serif italic 12px ink-3, 8px gap to value (8 px step §5.1) */}
      <p className="font-serif italic text-meta text-ink-3 mb-2 leading-snug">
        {/* italic-allow: spec §5 stat-card label */}
        {label}
      </p>
      {/* value — serif 600 (32px md / 24px sm), tabular-nums + tight tracking */}
      <p className="flex items-baseline gap-1 leading-none">
        <span
          className={cn(
            'font-serif font-semibold text-ink-1 tabular-nums tracking-tight',
            SIZE_VALUE[size],
          )}
        >
          {value}
        </span>
        {unit != null ? (
          <span className="font-serif italic font-normal text-small text-ink-3 ml-1">
            {/* italic-allow: spec §5 stat-card unit */}
            {unit}
          </span>
        ) : null}
      </p>
      {/* delta — serif italic 11px, ok / err / ink-3, 8px gap (8 px step §5.1) */}
      {delta !== undefined ? (
        <p
          className={cn(
            'mt-2 font-serif italic text-tiny leading-snug',
            DELTA_TONE[delta.direction],
          )}
        >
          {/* italic-allow: spec §5 stat-card delta */}
          <span aria-hidden="true" className="mr-1">
            {DELTA_GLYPH[delta.direction]}
          </span>
          {delta.value}
        </p>
      ) : null}
    </div>
  );
}
