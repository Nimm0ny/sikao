import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

export function DashboardCardState({
  loading,
  error,
  testId,
  children,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  if (loading) {
    return (
      <div
        className="flex min-h-24 items-center gap-2 text-body text-ink-3"
        data-testid={`${testId}-loading`}
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{DASHBOARD_COPY.status.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex min-h-24 items-start gap-2 rounded-card bg-bad-bg p-3 text-body text-err"
        data-testid={`${testId}-error`}
        role="alert"
      >
        <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <span>{DASHBOARD_COPY.status.error}</span>
      </div>
    );
  }

  return <>{children}</>;
}

export function DashboardEmptyText({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId: string;
}) {
  return (
    <p className="min-h-16 text-body leading-6 text-ink-3" data-testid={testId} role="status">
      {children}
    </p>
  );
}
