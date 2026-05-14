import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button, EmptyState } from '@sikao/ui/ui';
import { AlertCircleIcon, RefreshIcon } from '@sikao/ui/icons';

export interface QueryBoundaryProps<TData> {
  readonly query: Pick<
    UseQueryResult<TData, unknown>,
    'data' | 'error' | 'isError' | 'isLoading' | 'isPending' | 'refetch'
  >;
  readonly testId: string;
  readonly skeleton: ReactNode;
  readonly errorTitle: ReactNode;
  readonly errorDescription?: ReactNode;
  readonly emptyWhen?: (data: TData) => boolean;
  readonly emptyState?: ReactNode;
  readonly children: (data: TData) => ReactNode;
}

export function QueryBoundary<TData>({
  query,
  testId,
  skeleton,
  errorTitle,
  errorDescription,
  emptyWhen,
  emptyState,
  children,
}: QueryBoundaryProps<TData>) {
  if ((query.isLoading || query.isPending) && query.data === undefined) {
    return <div data-testid={`${testId}-skeleton`}>{skeleton}</div>;
  }

  if (query.isError) {
    return (
      <EmptyState
        tone="error"
        icon={<AlertCircleIcon className="w-8 h-8" aria-hidden="true" />}
        title={errorTitle}
        description={errorDescription}
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshIcon className="w-4 h-4" aria-hidden="true" />}
            onClick={() => {
              void query.refetch();
            }}
            data-testid={`${testId}-retry`}
          >
            重试
          </Button>
        }
      />
    );
  }

  if (query.data === undefined) {
    return <div data-testid={`${testId}-skeleton`}>{skeleton}</div>;
  }

  if (emptyWhen?.(query.data) === true) {
    return emptyState ?? null;
  }

  return <>{children(query.data)}</>;
}
