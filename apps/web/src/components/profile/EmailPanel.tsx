import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card } from '@sikao/ui/ui';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { AUTH_COPY, PROFILE_COPY } from '@/lib/ui-copy';

export function EmailPanel() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  if (user === null) return null;

  const hasEmail = user.email !== null && user.email !== undefined;
  const isVerified = user.emailVerified === true;

  return (
    <Card padding="md" data-testid="profile-email-card">
      <h2 className="font-bold text-ink mb-3">{PROFILE_COPY.emailPanelTitle}</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink truncate flex-1" data-testid="profile-email-display">
            {hasEmail ? user.email : PROFILE_COPY.emailPanelEmpty}
          </span>
          {hasEmail ? (
            <Badge
              tone={isVerified ? 'success' : 'warn'}
              variant="hairline"
              data-testid={isVerified ? 'profile-email-verified-chip' : 'profile-email-pending-chip'}
            >
              {isVerified ? AUTH_COPY.verify.verifiedChip : AUTH_COPY.verify.pendingChip}
            </Badge>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/bind-email')}
          data-testid="profile-email-bind-link"
        >
          {hasEmail ? PROFILE_COPY.emailPanelChangeAction : PROFILE_COPY.emailPanelBindAction}
        </Button>
      </div>
    </Card>
  );
}
