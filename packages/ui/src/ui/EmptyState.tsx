import type { ReactNode } from 'react';
import { cn } from '@sikao/shared-utils';

// Phase 5.1 rebrand: title 改 serif italic heading（element editorial 风）。
// dashed card 保留 — "no data yet" / "feature coming" 的 muted empty 表达。
//
// 2026-04-28 (UI polish S1): 加 tone='error' variant (additive, default 'muted'
// 不变), 错误态用 solid 1px --danger 边框 + danger icon, role 升级为 alert。
// 不新建 ErrorState 独立组件 (避免重复职责)。文案 SSOT 见 lib/ui-copy.ts。

export type EmptyStateTone = 'muted' | 'error';

export interface EmptyStateProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly tone?: EmptyStateTone;
  readonly className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = 'muted',
  className,
}: EmptyStateProps) {
  const isError = tone === 'error';
  return (
    <div
      className={cn(
        'bg-surface rounded-card-lg px-6 py-10 text-center border',
        isError ? 'border-err' : 'border-dashed border-line',
        className,
      )}
      role={isError ? 'alert' : 'status'}
      data-tone={tone}
    >
      {icon != null ? (
        <div
          className={cn(
            'flex justify-center mb-3',
            isError ? 'text-err' : 'text-ink-4',
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="font-serif text-xl font-medium text-ink">{title}</div>
      {description != null ? (
        <p className="mt-2 text-sm text-ink-3 leading-relaxed">{description}</p>
      ) : null}
      {action != null ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
