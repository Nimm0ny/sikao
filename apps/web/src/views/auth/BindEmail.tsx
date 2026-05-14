import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircleIcon, StatusDoneIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';

// commit #6i: bind email view (登录后绑定邮箱, verify-then-write D10).
//
// 双 step 共一个路径 `/bind-email` (跟 backend send_link 拼的 URL 对齐):
//   - 无 token: 输入新邮箱 → POST /bind/email/send-link → "已发送" success
//   - 有 token: 输入密码 → POST /bind/email/confirm → 写 user.email + 跳 /profile
//
// require-auth (route 层 RedirectGuard 保护). bind 必须 logged-in. 跟
// register/email 隔离 (D10/D16: bind 走 pre_register_codes purpose=bind_email).

interface SendResponse {
  readonly ok: true;
  readonly _devMagicLink?: string;
}

interface FormError {
  readonly title: string;
  readonly description?: string;
}

function classifyBindError(err: unknown, mode: 'send' | 'confirm'): FormError {
  const msg = String(err);
  if (mode === 'send') {
    if (msg.includes('email_taken') || msg.includes('identifier_taken') || msg.includes('409')) {
      return ERROR_COPY.bindEmailTaken;
    }
    if (msg.includes('email_already_bound')) {
      return ERROR_COPY.bindAlreadyBound;
    }
  }
  if (mode === 'confirm') {
    if (msg.includes('token_invalid') || msg.includes('410')) {
      return ERROR_COPY.bindTokenInvalid;
    }
    if (msg.includes('password') || msg.includes('401')) {
      return ERROR_COPY.bindPasswordWrong;
    }
  }
  return ERROR_COPY.bindNetwork;
}

export default function BindEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const token = searchParams.get('token') ?? '';
  const isConfirmStep = token !== '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentDevLink, setSentDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!email.includes('@')) {
      toast.warn('邮箱格式有误');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await api.post<SendResponse, { email: string }>(
        '/auth/bind/email/send-link',
        { email: email.trim() },
      );
      setSent(true);
      setSentDevLink(resp._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.bind.email.send.failed', { err: String(err) });
      const next = classifyBindError(err, 'send');
      setFormError(next);
      toast.error(next.title, next.description);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      toast.warn('输入密码');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await api.post<{ ok: true; user: AuthUserSummary }, { token: string; password: string }>(
        '/auth/bind/email/confirm',
        { token, password },
      );
      if (user !== null) {
        setSession({ ...user, ...resp.user }, 0);
      }
      setConfirmed(true);
      toast.info(AUTH_COPY.bindEmail.successTitle);
      setTimeout(() => navigate('/profile', { replace: true }), 1500);
    } catch (err) {
      logger.error('auth.bind.email.confirm.failed', { err: String(err) });
      const next = classifyBindError(err, 'confirm');
      setFormError(next);
      toast.error(next.title, next.description);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell testId="bind-email-view">
        {confirmed ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.bindEmail.successTitle}
            </h1>
            <p className="text-sm text-ink-3 leading-relaxed">
              {AUTH_COPY.bindEmail.successDesc}
            </p>
          </div>
        ) : sent && !isConfirmStep ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.bindEmail.sentTitle}
            </h1>
            <p className="text-sm text-ink-3 mb-6 leading-relaxed">
              {AUTH_COPY.bindEmail.sentDesc}
            </p>
            {sentDevLink !== null ? (
              <div
                data-testid="bind-email-dev-link"
                className="w-full px-3 py-2 mb-6 border border-line border-dashed rounded-card text-xs text-ink-3 break-all font-mono"
              >
                {/* backend dev gate 只返 raw token, FE 拼完整 URL 方便 dev 直接点 */}
                {`${window.location.origin}/bind-email?token=${sentDevLink}`}
              </div>
            ) : null}
            <Link
              to="/profile"
              className="text-sm text-ink-3 hover:text-ink underline-offset-2 hover:underline transition-colors duration-fast ease-motion"
            >
              {AUTH_COPY.bindEmail.backToProfile}
            </Link>
          </div>
        ) : isConfirmStep ? (
          <>
            <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
              {AUTH_COPY.bindEmail.confirmTitle}
            </h1>
            <p className="text-base text-ink-3 mb-8">{AUTH_COPY.bindEmail.confirmSubtitle}</p>

            <form onSubmit={handleConfirm} className="flex flex-col gap-4" noValidate>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <div>
                <label
                  id="bind-email-confirm-password-label"
                  htmlFor="bind-email-confirm-password"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindEmail.passwordLabel}
                </label>
                <input
                  id="bind-email-confirm-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="bind-email-password"
                  aria-labelledby="bind-email-confirm-password-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>

              {formError !== null ? (
                <div
                  role="alert"
                  data-testid="bind-email-form-error"
                  className="flex items-start gap-2 px-3 py-2 border border-err rounded-card text-sm text-ink"
                >
                  <AlertCircleIcon className="w-4 h-4 mt-1 text-err shrink-0" />
                  <div>
                    <div className="font-semibold">{formError.title}</div>
                    {formError.description !== undefined ? (
                      <div className="text-xs text-ink-3 mt-1">{formError.description}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="bind-email-confirm-submit"
                className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
              >
                {isSubmitting ? AUTH_COPY.bindEmail.confirmingButton : AUTH_COPY.bindEmail.confirmButton}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
              {AUTH_COPY.bindEmail.sendTitle}
            </h1>
            <p className="text-base text-ink-3 mb-8">{AUTH_COPY.bindEmail.sendSubtitle}</p>

            <form onSubmit={handleSend} className="flex flex-col gap-4" noValidate>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <div>
                <label
                  id="bind-email-email-label"
                  htmlFor="bind-email-email"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindEmail.emailLabel}
                </label>
                <input
                  id="bind-email-email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="bind-email-email"
                  aria-labelledby="bind-email-email-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>

              {formError !== null ? (
                <div
                  role="alert"
                  data-testid="bind-email-send-error"
                  className="flex items-start gap-2 px-3 py-2 border border-err rounded-card text-sm text-ink"
                >
                  <AlertCircleIcon className="w-4 h-4 mt-1 text-err shrink-0" />
                  <div>
                    <div className="font-semibold">{formError.title}</div>
                    {formError.description !== undefined ? (
                      <div className="text-xs text-ink-3 mt-1">{formError.description}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="bind-email-send-submit"
                className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
              >
                {isSubmitting ? AUTH_COPY.bindEmail.sendingButton : AUTH_COPY.bindEmail.sendButton}
              </button>
            </form>

            <div className="mt-10 flex justify-center text-sm">
              <Link
                to="/profile"
                className="text-ink-3 hover:text-ink underline-offset-2 hover:underline transition-colors duration-fast ease-motion"
              >
                {AUTH_COPY.bindEmail.backToProfile}
              </Link>
            </div>
          </>
        )}
    </AuthShell>
  );
}
