import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, StatusDoneIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';
import SendCodeButton from '@/components/auth/SendCodeButton';

// commit #6i: bind phone view (登录后绑定/换手机, verify-then-write D10).
//
// 单页 form: 输入 phone + send code (走 /auth/bind/phone/send-code) → 输入
// code + password → POST /auth/bind/phone/confirm → 写 user.phone + 跳 /profile.
//
// require-auth (RedirectGuard 保护). password 二次确认 (D12, 防 token leak).

interface FormError {
  readonly title: string;
  readonly description?: string;
}

function classifyBindError(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('phone_taken') || msg.includes('identifier_taken') || msg.includes('409')) {
    return ERROR_COPY.bindPhoneTaken;
  }
  if (msg.includes('phone_already_bound')) {
    return ERROR_COPY.bindAlreadyBound;
  }
  if (msg.includes('code_invalid') || msg.includes('410')) {
    return ERROR_COPY.bindCodeInvalid;
  }
  if (msg.includes('password') || msg.includes('401')) {
    return ERROR_COPY.bindPasswordWrong;
  }
  return ERROR_COPY.bindNetwork;
}

export default function BindPhone() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (phone.trim().length < 11) {
      toast.warn('手机号格式有误');
      return;
    }
    if (!/^\d{6}$/.test(smsCode)) {
      toast.warn('验证码为 6 位数字');
      return;
    }
    if (password.length < 6) {
      toast.warn('输入密码');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await api.post<
        { ok: true; user: AuthUserSummary },
        { phone: string; smsCode: string; password: string }
      >('/auth/bind/phone/confirm', {
        phone: phone.trim(),
        smsCode,
        password,
      });
      if (user !== null) {
        setSession({ ...user, ...resp.user }, 0);
      }
      setConfirmed(true);
      toast.info(AUTH_COPY.bindPhone.successTitle);
      setTimeout(() => navigate('/profile', { replace: true }), 1500);
    } catch (err) {
      logger.error('auth.bind.phone.failed', { phone, err: String(err) });
      const next = classifyBindError(err);
      setFormError(next);
      toast.error(next.title, next.description);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell testId="bind-phone-view">
        {confirmed ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.bindPhone.successTitle}
            </h1>
            <p className="text-sm text-ink-3 leading-relaxed">
              {AUTH_COPY.bindPhone.successDesc}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
              {AUTH_COPY.bindPhone.title}
            </h1>
            <p className="text-base text-ink-3 mb-8">{AUTH_COPY.bindPhone.subtitle}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <div>
                <label
                  id="bind-phone-phone-label"
                  htmlFor="bind-phone-phone"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindPhone.phoneLabel}
                </label>
                <input
                  id="bind-phone-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="138 0013 8000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="bind-phone-phone"
                  aria-labelledby="bind-phone-phone-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  id="bind-phone-code-label"
                  htmlFor="bind-phone-code"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindPhone.codeLabel}
                </label>
                <div className="flex gap-2 items-stretch">
                  <input
                    id="bind-phone-code"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 位数字"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    data-testid="bind-phone-code"
                    aria-labelledby="bind-phone-code-label"
                    className="flex-1 min-w-0 px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                  />
                  <SendCodeButton phone={phone} purpose="bind_phone" />
                </div>
                <div className="mt-2 text-xs text-ink-3">发送后 60 秒内有效，未收到可重发。</div>
              </div>

              <div>
                <label
                  id="bind-phone-password-label"
                  htmlFor="bind-phone-password"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindPhone.passwordLabel}
                </label>
                <input
                  id="bind-phone-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="bind-phone-password"
                  aria-labelledby="bind-phone-password-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>

              {formError !== null ? (
                <div
                  role="alert"
                  data-testid="bind-phone-form-error"
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
                data-testid="bind-phone-submit"
                className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
              >
                {isSubmitting ? AUTH_COPY.bindPhone.submittingButton : AUTH_COPY.bindPhone.submitButton}
              </button>
            </form>

            <div className="mt-10 flex justify-center text-sm">
              <Link
                to="/profile"
                className="text-ink-3 hover:text-ink underline-offset-2 hover:underline transition-colors duration-fast ease-motion"
              >
                {AUTH_COPY.bindPhone.backToProfile}
              </Link>
            </div>
          </>
        )}
    </AuthShell>
  );
}
