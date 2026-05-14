import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios, { type AxiosError } from 'axios';
import { AlertCircleIcon, StatusDoneIcon, WarningIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

// Phase B.5a — Reset password view.
//
// 后端 410 + code=token_invalid 涵盖 假 / used / expired 三种场景, UI
// 视为同一种 "链接已失效" 状态 (用户视角无差别), 跳 forgot 重新申请.
//
// commit #6h: 视觉对齐 v1-minimal claude.com 风, 跟 5a/5b/5c/5d 一致.
// EmptyState 替换为 inline card pattern, success-bullet 圆形 ✓.

interface ResetResponse {
  readonly ok: true;
}

interface ApiError {
  readonly detail?: string;
  readonly code?: string;
}

function isTokenInvalid(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const ax = err as AxiosError<ApiError>;
  return ax.response?.status === 410;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(token === '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (newPassword.length < 6) {
      setFormError(AUTH_COPY.reset.newPasswordHint);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(AUTH_COPY.reset.mismatchError);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post<ResetResponse, { token: string; newPassword: string }>(
        '/auth/reset-password',
        { token, newPassword },
      );
      setDone(true);
      toast.info(AUTH_COPY.reset.successTitle);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      logger.error('auth.reset.failed', { err: String(err) });
      if (isTokenInvalid(err)) {
        setTokenInvalid(true);
      } else {
        toast.error(AUTH_COPY.reset.networkError);
        throw err;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell testId="reset-view">
        {tokenInvalid ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-bad-bg text-err rounded-pill flex items-center justify-center">
              <WarningIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.reset.expiredTitle}
            </h1>
            <p className="text-sm text-ink-3 mb-6 leading-relaxed">
              {AUTH_COPY.reset.expiredDesc}
            </p>
            <Link
              to="/forgot-password"
              data-testid="reset-request-new"
              className="text-sm text-ink font-medium hover:underline underline-offset-2"
            >
              {AUTH_COPY.reset.requestNewLink}
            </Link>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.reset.successTitle}
            </h1>
            <p className="text-sm text-ink-3 leading-relaxed">
              {AUTH_COPY.reset.successDesc}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
              {AUTH_COPY.reset.title}
            </h1>
            <p className="text-base text-ink-3 mb-8">{AUTH_COPY.reset.subtitle}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <div>
                <label
                  id="reset-new-password-label"
                  htmlFor="reset-new-password"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.reset.newPasswordLabel}
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="reset-new-password"
                  aria-labelledby="reset-new-password-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
                <div className="mt-2 text-xs text-ink-3">{AUTH_COPY.reset.newPasswordHint}</div>
              </div>

              <div>
                <label
                  id="reset-confirm-password-label"
                  htmlFor="reset-confirm-password"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.reset.confirmPasswordLabel}
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="reset-confirm-password"
                  aria-labelledby="reset-confirm-password-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>

              {formError !== null ? (
                <div
                  role="alert"
                  data-testid="reset-form-error"
                  className="flex items-start gap-2 px-3 py-2 border border-err rounded-card text-sm text-ink"
                >
                  <AlertCircleIcon className="w-4 h-4 mt-1 text-err shrink-0" />
                  <div>{formError}</div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="reset-submit"
                className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
              >
                {isSubmitting ? AUTH_COPY.reset.submitting : AUTH_COPY.reset.submit}
              </button>
            </form>
          </>
        )}
    </AuthShell>
  );
}
