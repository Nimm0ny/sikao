import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon, LockIcon, MailIcon, PhoneIcon } from '@sikao/ui/icons';
import { Badge, Card } from '@sikao/ui/ui';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { AUTH_COPY, PROFILE_COPY } from '@/lib/ui-copy';

// AccountSecuritySection · Identity v2 wire 补漏 (Profile v2 §B2, 2026-05-08).
//
// Why: Profile.tsx grep `phone|password` 0 命中 = Identity v2 三态用户在 FE
// wire 漏配 P0 (commit #6h-#6r ship 后这块未补). 本组件给 Email/Phone/Password
// 三个 row, 跳到对应 view 或 disabled 占位.
//
// Password row 必须 disabled: backend 0 个 /auth/change-password endpoint
// (apps/exam-api 仅有 /reset-password 匿名 reset 流). 走 reset-password 替代
// 修改密码 = 安全反模式 (不验证当前密码), 必须等 backend ship verify-then-write
// 接口后再开. 不加 toast / dialog — disabled 就是 disabled.

interface RowProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly badge?: React.ReactNode;
  readonly onClick: () => void;
  readonly testId: string;
}

function NavRow({ icon, title, subtitle, badge, onClick, testId }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon}
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{title}</p>
          <p className="text-xs text-ink-3 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <ChevronRightIcon className="w-5 h-5 text-ink-3" />
      </div>
    </button>
  );
}

interface EmailPhoneRowProps {
  readonly user: AuthUserSummary;
  readonly onClick: () => void;
}

function EmailRow({ user, onClick }: EmailPhoneRowProps) {
  const hasEmail = user.email !== null && user.email !== undefined;
  const verified = user.emailVerified === true;
  return (
    <NavRow
      icon={<MailIcon className="w-5 h-5 text-ink-3 shrink-0" />}
      title={hasEmail ? (user.email ?? '') : PROFILE_COPY.securityEmailFallback}
      subtitle={hasEmail ? PROFILE_COPY.securityBoundSubtitle : PROFILE_COPY.securityUnboundSubtitle}
      badge={
        hasEmail ? (
          <Badge
            tone={verified ? 'success' : 'warn'}
            variant="hairline"
            data-testid={
              verified
                ? 'profile-security-email-verified-chip'
                : 'profile-security-email-pending-chip'
            }
          >
            {verified ? AUTH_COPY.verify.verifiedChip : AUTH_COPY.verify.pendingChip}
          </Badge>
        ) : (
          <span className="text-xs text-ink-3">{PROFILE_COPY.securityBindEmailCta}</span>
        )
      }
      onClick={onClick}
      testId="profile-security-email-row"
    />
  );
}

function PhoneRow({ user, onClick }: EmailPhoneRowProps) {
  const hasPhone = user.phone !== null && user.phone !== undefined;
  const verified = user.phoneVerified === true;
  return (
    <NavRow
      icon={<PhoneIcon className="w-5 h-5 text-ink-3 shrink-0" />}
      title={hasPhone ? (user.phone ?? '') : PROFILE_COPY.securityPhoneFallback}
      subtitle={hasPhone ? PROFILE_COPY.securityBoundSubtitle : PROFILE_COPY.securityUnboundSubtitle}
      badge={
        hasPhone ? (
          <Badge
            tone={verified ? 'success' : 'warn'}
            variant="hairline"
            data-testid={
              verified
                ? 'profile-security-phone-verified-chip'
                : 'profile-security-phone-pending-chip'
            }
          >
            {verified ? AUTH_COPY.verify.verifiedChip : AUTH_COPY.verify.pendingChip}
          </Badge>
        ) : (
          <span className="text-xs text-ink-3">{PROFILE_COPY.securityBindPhoneCta}</span>
        )
      }
      onClick={onClick}
      testId="profile-security-phone-row"
    />
  );
}

function PasswordRow() {
  // TODO(2026-05-15 lhr): 等 backend POST /auth/change-password (verify
  // current_password + write new), FE 加 ChangePassword view + wire 此 row.
  // 不允许跳 /reset-password 替代 (那是匿名 token-based reset 流, 不验证
  // 当前密码 = 安全反模式).
  return (
    <button
      type="button"
      aria-disabled="true"
      tabIndex={-1}
      className="w-full flex items-center justify-between py-3 text-left opacity-50 cursor-not-allowed"
      data-testid="profile-password-row-disabled"
    >
      <div className="flex items-center gap-3">
        <LockIcon className="w-5 h-5 text-ink-3 shrink-0" />
        <div>
          <p className="font-medium text-ink">{PROFILE_COPY.securityPasswordTitle}</p>
          <p className="text-xs text-ink-3">{PROFILE_COPY.securityPasswordSubtitle}</p>
        </div>
      </div>
    </button>
  );
}

export function AccountSecuritySection() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  if (user === null) return null;

  return (
    <Card padding="md" data-testid="profile-security-section">
      <h2 className="font-bold text-ink mb-3">{PROFILE_COPY.securityTitle}</h2>
      <div className="divide-y divide-line">
        <EmailRow user={user} onClick={() => navigate('/bind-email')} />
        <PhoneRow user={user} onClick={() => navigate('/bind-phone')} />
        <PasswordRow />
      </div>
    </Card>
  );
}
