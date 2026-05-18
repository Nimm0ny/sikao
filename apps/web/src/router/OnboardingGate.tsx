import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboardingStatus } from '@sikao/api-client/queries/onboardingQueries';
import { Button, EmptyState } from '@sikao/ui/ui';
import { AlertCircleIcon, RefreshIcon } from '@sikao/ui/icons';

const ONBOARDING_ALLOWED_PATHS = new Set([
  '/study/onboarding',
  '/bind-email',
  '/bind-phone',
]);

interface OnboardingGateProps {
  readonly children: ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const location = useLocation();
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useOnboardingStatus();

  if (ONBOARDING_ALLOWED_PATHS.has(location.pathname)) {
    if (location.pathname === '/study/onboarding' && data?.isOnboarded === true) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        data-testid="onboarding-gate-loading"
      >
        <p className="text-sm text-ink-3">正在检查建档状态…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title="建档状态加载失败"
          description="请检查网络或服务状态后重试。"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void refetch();
              }}
              data-testid="onboarding-gate-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (data?.isOnboarded === false) {
    return (
      <Navigate
        to="/study/onboarding"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}
