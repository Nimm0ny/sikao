import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoaderIcon, StatusDoneIcon, WarningIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthStatusState } from '@/components/auth/AuthStatusState';
import { api } from '@sikao/api-client/request';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

interface ConfirmResponse {
  readonly ok: true;
  readonly user: {
    readonly id: number;
    readonly username: string;
    readonly displayName: string;
  };
}

type Status = 'loading' | 'success' | 'failed';

export default function VerifyEmailLanding() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isLoggedIn = useAuthStore((state) => state.user !== null);
  const [status, setStatus] = useState<Status>(() => (token === '' ? 'failed' : 'loading'));

  useEffect(() => {
    if (token === '') return;
    let cancelled = false;

    void (async () => {
      try {
        await api.post<ConfirmResponse, { token: string }>('/auth/verify-email/confirm', {
          token,
        });
        if (!cancelled) {
          setStatus('success');
        }
      } catch (err) {
        logger.error('auth.verify_email.failed', { err: String(err) });
        if (!cancelled) {
          setStatus('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell testId={`verify-${status}`} maxWidthClass="max-w-[420px]">
      {status === 'loading' ? (
        <AuthStatusState
          icon={<LoaderIcon className="h-6 w-6 animate-spin" />}
          description="正在验证…"
          tone="neutral"
        />
      ) : status === 'success' ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.verify.successTitle}
          description={AUTH_COPY.verify.successDesc}
          tone="success"
        >
          <Link
            to={isLoggedIn ? '/profile' : '/login'}
            data-testid="verify-success-link"
            className="text-sm text-accent hover:underline underline-offset-2"
          >
            {isLoggedIn ? AUTH_COPY.verify.backToProfile : AUTH_COPY.verify.backToLogin}
          </Link>
        </AuthStatusState>
      ) : (
        <AuthStatusState
          icon={<WarningIcon className="h-5 w-5" />}
          title={AUTH_COPY.verify.failedTitle}
          description={AUTH_COPY.verify.failedDesc}
          tone="warning"
        >
          <Link
            to="/login"
            data-testid="verify-failed-link"
            className="text-sm text-accent hover:underline underline-offset-2"
          >
            {AUTH_COPY.verify.backToLogin}
          </Link>
        </AuthStatusState>
      )}
    </AuthShell>
  );
}
