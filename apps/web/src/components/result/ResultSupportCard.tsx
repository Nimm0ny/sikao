import type { ReactElement } from 'react';
import { MvpCard } from '@/components/mvp';
import { ResultIconAction } from './ResultIconAction';

export interface ResultSupportCardProps {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionIcon: ReactElement;
  readonly onAction: () => void;
  readonly actionAriaLabel?: string;
  readonly actionTestId?: string;
  readonly testId?: string;
}

export function ResultSupportCard({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionAriaLabel,
  actionTestId,
  testId,
}: ResultSupportCardProps) {
  return (
    <MvpCard className="flex h-full flex-col p-5" testId={testId}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-card bg-accent-50 text-accent">
        {icon}
      </div>
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      <p className="mt-2 min-h-12 text-body leading-6 text-ink-3">{description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-small font-semibold text-ink">{actionLabel}</p>
        <ResultIconAction
          label={actionAriaLabel ?? actionLabel}
          onClick={onAction}
          size="md"
          testId={actionTestId}
        >
          {actionIcon}
        </ResultIconAction>
      </div>
    </MvpCard>
  );
}
