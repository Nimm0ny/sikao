import type { ReactElement } from 'react';

import { Navigate, useParams } from 'react-router-dom';

import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

export function RootRoute({
  guest,
  authenticated,
}: {
  readonly guest: ReactElement;
  readonly authenticated: ReactElement;
}): ReactElement {
  const user = useAuthStore((state) => state.user);
  if (user === null) {
    return guest;
  }
  return authenticated;
}

export function LegacyWrongBookItemRedirect({
  suffix = '',
}: {
  readonly suffix?: string;
}): ReactElement {
  const { questionId } = useParams<{ questionId: string }>();
  if (!questionId) {
    return <Navigate to="/review" replace />;
  }
  return <Navigate to={`/review/items/${questionId}${suffix}`} replace />;
}
