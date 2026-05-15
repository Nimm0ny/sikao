import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboardingStatus } from '@sikao/api-client/queries/onboardingQueries';

interface OnboardingGateProps {
  readonly children: ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const location = useLocation();
  const { data } = useOnboardingStatus();

  if (data?.isOnboarded === false) {
    return (
      <Navigate
        to="/study/onboarding"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
