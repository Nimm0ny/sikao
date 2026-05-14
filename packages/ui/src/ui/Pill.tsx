import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial status pill (read-only tag).
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .pill (line ~194-204).
//   .pill {
//     display: inline-flex; align-items: center; gap: 4px;
//     font-family: 'Source Serif 4'; font-style: italic;
//     font-size: 11px; color: var(--ink-3);
//     border: 1px solid var(--line-3); border-radius: var(--r-pill);
//     padding: 2px 10px;
//   }
//   .pill.ok   { color: var(--ok);   border-color: var(--ok); }
//   .pill.warn { color: var(--warn); border-color: var(--warn); }
//   .pill.err  { color: var(--err);  border-color: var(--err); }
//   .pill.ink  { color: var(--paper-1); background: var(--ink-1); border-color: var(--ink-1); }
//
// 解耦关系:
//   - Chip   = serif (无 italic), toggle 语义, padding 5/13, ink-2 → ink-1
//   - Pill   = serif italic, 只读 status tag, padding 2/10, ink-3 → tone 色
//   - Badge  = (已存在) status badge 不同语义, 跟 Pill 共存
//
// italic 在 Pill 是合法 (Pill 内容默认 ASCII / 数字 / 短英文 status text;
// CJK 内容不应进 Pill, 应该改用 Chip + serif 不带 italic). 文件 head escape:
// italic-allow: design SSOT explicit (§5).

export type PillTone = 'default' | 'ok' | 'warn' | 'err' | 'ink';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  readonly children: ReactNode;
  readonly tone?: PillTone;
  /** 可选前置 icon (e.g. small svg / dot). */
  readonly icon?: ReactNode;
}

const BASE =
  'inline-flex items-center gap-1 rounded-pill border ' +
  'font-serif italic font-normal text-tiny ' + // italic-allow: spec §5 read-only tag
  'px-3 py-1 leading-none'; // 规范 §5 padding 2/10 — Tailwind 8px 阶梯就近取整 (§5.1)

const TONE: Record<PillTone, string> = {
  default: 'border-line-3 text-ink-3 bg-transparent',
  ok: 'border-ok text-ok bg-transparent',
  warn: 'border-warn text-warn bg-transparent',
  err: 'border-err text-err bg-transparent',
  ink: 'border-ink-1 bg-ink-1 text-paper-1',
};

export function Pill({
  children,
  tone = 'default',
  icon,
  className,
  ...rest
}: PillProps): ReactNode {
  return (
    <span className={cn(BASE, TONE[tone], className)} {...rest}>
      {icon != null ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
