import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// SIKAO Phase 1' (2026-05-09): left/right column container.
//
// 设计 SSOT: `design/SIKAO/handoff/design/components.md` (.rail anchor):
//   "Rail — 左/右栏容器, 1px 描边 + sticky"
//
// 行测列表 / 申论双栏 / dashboard 三栏 layout 共用的容器 primitive. 把
// 「侧栏 sticky 顶, 1px hairline border, paper bg」收敛到一个 SSOT, 避免
// 各 view 重复手写 className.
//
// Variants:
//   - side: 'left' | 'right' (决定 border 在 right 还是 left)
//   - sticky: boolean (默认 true; sticky top-0 自带 h-screen overflow)
//
// 不接管内容滚动 — caller 自己包 div + overflow-y-auto. 这样 caller 可以
// 在 sticky 容器内放 fixed header + scroll body, 行测 03 就是这个结构.

export type RailSide = 'left' | 'right';

export interface RailProps extends HTMLAttributes<HTMLElement> {
  readonly as?: 'aside' | 'nav' | 'div';
  readonly side?: RailSide;
  readonly sticky?: boolean;
  readonly children?: ReactNode;
}

const SIDE_BORDER: Record<RailSide, string> = {
  left: 'border-r border-line',
  right: 'border-l border-line',
};

export function Rail({
  as: Tag = 'aside',
  side = 'left',
  sticky = true,
  className,
  children,
  ...rest
}: RailProps) {
  return (
    <Tag
      className={cn(
        'bg-surface text-ink',
        SIDE_BORDER[side],
        sticky && 'sticky top-0 h-screen',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
