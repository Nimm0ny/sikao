import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Frontend Style Guide v1 (PR3) primitive — editorial toast (single item view).
//
// 规范 SSOT: docs/design/Frontend Style Guide.html §5 .toast (line ~496-507).
//   .toast {
//     display: inline-flex; align-items: center; gap: 10px;
//     background: var(--ink-1); color: var(--paper-1);
//     border-radius: var(--r-tiny);
//     padding: 10px 14px;
//     font-size: 13px; box-shadow: var(--shadow-pop);
//     max-width: 380px;
//   }
//   .toast .dot {
//     width: 6px; height: 6px; border-radius: 50%;
//     background: var(--accent-2);  /* default */
//   }
//   .toast.ok   .dot { background: var(--ok); }
//   .toast.err  .dot { background: var(--err); }
//   .toast.warn .dot { background: var(--warn); }
//
// 跟 ToastHost 解耦: 本 primitive 只渲染单条; ToastHost 负责 queue + auto-dismiss
// + ARIA live region. Toast 自身 stateless, 可在任意位置 inline 使用 (e.g.
// ComponentGallery demo / Storybook stub).
//
// 规范无 close 按钮; 4s 自动关由 host 队列控制. tone='info' 默认走 accent-2 dot
// (代表"信息" / 中性提示); ok / warn / err 走对应 semantic 色.

export type ToastTone = 'info' | 'ok' | 'warn' | 'err';

export interface ToastProps {
  readonly tone?: ToastTone;
  readonly children: ReactNode;
  readonly className?: string;
}

const BASE =
  'inline-flex items-center gap-3 max-w-[380px] ' +
  'bg-ink-1 text-paper-1 rounded-tiny shadow-pop ' +
  'px-4 py-3 text-small leading-snug';

const DOT_TONE: Record<ToastTone, string> = {
  info: 'bg-accent-2',
  ok: 'bg-ok',
  warn: 'bg-warn',
  err: 'bg-err',
};

export function Toast({
  tone = 'info',
  children,
  className,
}: ToastProps): ReactNode {
  return (
    <div role="status" className={cn(BASE, className)}>
      <span
        aria-hidden="true"
        data-pattern="dot"
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_TONE[tone])}
      />
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}
