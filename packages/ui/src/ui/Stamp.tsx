import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// SIKAO Phase 1' (2026-05-09): 印章式 metadata strip.
//
// 设计 SSOT: `design/SIKAO/handoff/design/components.md` (.stamp anchor):
//   "Stamp — uppercase mono + 暗朱小圆点 (印章式 metadata)"
//
// 用法: 列表 / 卡片角落标注 元数据 (PUBLISHED 2024 · GUOKAO · 行测), 或
// hero 区底部的"印章感" annotation (SIKAO · MMXXIV). 一屏最多 1-2 处 — 多了
// 失去印章稀缺感.
//
// 视觉:
//   - mono 11px uppercase letter-spacing 0.18em
//   - 默认 ink-3 字色 (淡笔触, 非主信息)
//   - 左侧暗朱小圆点 ø6px (accent token, 自动跟主题切换 — light 暗朱 / pure
//     blue / night 暖金) — 印章中心红点的语义抽象
//
// 不带交互 (display-only). caller 决定是否包 button 给点击.

export interface StampProps extends HTMLAttributes<HTMLSpanElement> {
  /** 是否显示左侧暗朱圆点. 默认 true. 单纯标注无锚点时可设 false. */
  readonly dot?: boolean;
  readonly children?: ReactNode;
}

// 6px 圆点 — 比 Badge dot 7px 略小, 印章感更细. data-pattern="dot" 让
// lint:radius-token 放过 rounded-pill (其实已是 token 名, 但显式 marker 更清晰).
const DOT_CLS = 'w-1.5 h-1.5 rounded-pill bg-accent shrink-0';

const BASE_CLS =
  'inline-flex items-center gap-2 font-mono text-tiny uppercase ' +
  'tracking-widest text-ink-3';

export function Stamp({ dot = true, className, children, ...rest }: StampProps) {
  return (
    <span className={cn(BASE_CLS, className)} {...rest}>
      {dot ? <span aria-hidden="true" data-pattern="dot" className={DOT_CLS} /> : null}
      <span>{children}</span>
    </span>
  );
}
