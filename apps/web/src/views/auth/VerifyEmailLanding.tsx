import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoaderIcon, StatusDoneIcon, WarningIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

// Phase B.5b — Verify email landing.
//
// 用户从邮件 click 来. mount 自动调 confirm endpoint, 后续根据成功/失败
// 显示对应 UX. P1-4 修订:
//   - 不签 JWT (后端 cookie/session 不变)
//   - 已登录 → "邮箱已验证" + 跳 /profile link
//   - 未登录 → "邮箱已验证" + 跳 /login link
//   - 失败 → 错误图标 + 跳 /login link
//
// commit #6h: 视觉对齐 v1-minimal claude.com 风, 卡片包装 + LogoMark + 圆形 ✓.

interface ConfirmResponse {
  readonly ok: true;
  readonly user: { readonly id: number; readonly username: string; readonly displayName: string };
}

type Status = 'loading' | 'success' | 'failed';

export default function VerifyEmailLanding() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isLoggedIn = useAuthStore((s) => s.user !== null);
  // Initial status 走 lazy init — 空 token 直接 failed.
  const [status, setStatus] = useState<Status>(() => (token === '' ? 'failed' : 'loading'));

  useEffect(() => {
    if (token === '') return;
    let cancelled = false;
    void (async () => {
      try {
        await api.post<ConfirmResponse, { token: string }>(
          '/auth/verify-email/confirm',
          { token },
        );
        if (!cancelled) setStatus('success');
      } catch (err) {
        logger.error('auth.verify_email.failed', { err: String(err) });
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell testId={`verify-${status}`}>
        {status === 'loading' ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 text-ink-3 flex items-center justify-center">
              <LoaderIcon className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-sm text-ink-3">正在验证…</p>
          </div>
        ) : status === 'success' ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.verify.successTitle}
            </h1>
            <p className="text-sm text-ink-3 mb-6 leading-relaxed">
              {AUTH_COPY.verify.successDesc}
            </p>
            <Link
              to={isLoggedIn ? '/profile' : '/login'}
              data-testid="verify-success-link"
              className="text-sm text-ink font-medium hover:underline underline-offset-2"
            >
              {isLoggedIn ? AUTH_COPY.verify.backToProfile : AUTH_COPY.verify.backToLogin}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-bad-bg text-err rounded-pill flex items-center justify-center">
              <WarningIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.verify.failedTitle}
            </h1>
            <p className="text-sm text-ink-3 mb-6 leading-relaxed">
              {AUTH_COPY.verify.failedDesc}
            </p>
            <Link
              to="/login"
              data-testid="verify-failed-link"
              className="text-sm text-ink font-medium hover:underline underline-offset-2"
            >
              {AUTH_COPY.verify.backToLogin}
            </Link>
          </div>
        )}
    </AuthShell>
  );
}
