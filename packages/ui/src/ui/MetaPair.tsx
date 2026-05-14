import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.2 primitive — hairline key-value meta pair.
// 参考 element/preview/badges.html 的 "Exam" row（`.meta .k / .v`）。
//
// 视觉：
//   - inline-flex + border-bottom ink + padding 0 2px 3px
//   - label: mono uppercase 11px muted
//   - value: sans medium 14px ink
//
// 使用：`<MetaPair label="卷">2024 国考 · 行测</MetaPair>`

export interface MetaPairProps extends HTMLAttributes<HTMLSpanElement> {
  readonly label: ReactNode;
  readonly children: ReactNode;
}

export function MetaPair({ label, children, className, ...rest }: MetaPairProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-2 text-sm text-ink',
        'border-b border-ink px-1 pb-[3px]', // hardcode-allow: baseline alignment 跟 border-b 1px 校准, sub-pixel 微调
        className,
      )}
      {...rest}
    >
      <span className="font-mono text-tiny font-semibold tracking-wider uppercase text-ink-4">
        {label}
      </span>
      <span className="font-medium">{children}</span>
    </span>
  );
}
