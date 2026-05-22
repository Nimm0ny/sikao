import { useLocation, useNavigate } from 'react-router-dom';
import { LockIcon } from '@sikao/ui/icons';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface AuthFallbackEmptyStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly redirectTo?: string;
  readonly className?: string;
}

export function AuthFallbackEmptyState({
  title,
  description,
  actionLabel,
  redirectTo,
  className,
}: AuthFallbackEmptyStateProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (): void => {
    const target = redirectTo ?? `${location.pathname}${location.search}`;
    navigate('/login', { state: { from: target } });
  };

  return (
    <div data-testid="auth-fallback-empty-state" className={className}>
      <EmptyState
        icon={<LockIcon className="w-8 h-8" aria-hidden="true" />}
        title={title ?? '璇峰厛鐧诲綍'}
        description={description ?? '鐧诲綍鍚庡嵆鍙户缁煡鐪嬫椤甸潰.'}
        action={
          <Button
            variant="primary"
            onClick={handleLogin}
            data-testid="auth-fallback-login-cta"
          >
            {actionLabel ?? '鍓嶅線鐧诲綍'}
          </Button>
        }
      />
    </div>
  );
}
