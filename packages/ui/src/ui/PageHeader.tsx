import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// v0.3 T-C2 — 站内 page-level header SSOT.
// 之前 8 页各自手写 h1 + eyebrow + subtitle, 字号 24/28/30 三档随机.
// 统一收敛: text-3xl (= --fs-3xl = 30px) 作 page title; eyebrow 走 text-tiny;
// subtitle 走 text-sm + text-ink-3. 不新增 token (memory cleanup-status v0.3).
//
// 槽位: actions (右侧按钮组) + children (title 下方扩展, e.g. EssayPaperDetail
// 的 进入考场 CTA box). 都可选, 不传不渲染容器.

export interface PageHeaderProps {
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly testId?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
  testId,
}: PageHeaderProps) {
  return (
    <header
      data-testid={testId ?? 'page-header'}
      className={cn('space-y-2', className)}
    >
      {eyebrow != null ? (
        <span className="block text-tiny font-semibold tracking-[0.02em] text-ink-3">{/* hardcode-allow: eyebrow micro-adjust */}
          {eyebrow}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {actions != null ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {subtitle != null ? (
        <p className="text-sm text-ink-3 leading-relaxed max-w-2xl">{subtitle}</p>
      ) : null}
      {children}
    </header>
  );
}
