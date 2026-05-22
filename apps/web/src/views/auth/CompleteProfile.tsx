import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon, LogoutIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';
import SendCodeButton from '@/components/auth/SendCodeButton';

// commit #6i: complete-profile view. needsIdentifierSetup=true (老 user, email
// 与 phone 都 NULL, 仅 username_legacy) 走 /complete-profile 强制补全至少一个
// identifier (email 或 phone, 90 天 deprecation 过渡期).
//
// 当前用 bind/email/send-link + bind/phone/confirm 同 endpoint (logged-in 用户
// 视角下 bind 跟 complete 等价 — 服务端 D10 verify-then-write 模式不变).

type Tab = 'email' | 'phone';

interface FormError {
  readonly title: string;
  readonly description?: string;
}

interface SendResponse {
  readonly ok: true;
  readonly _devMagicLink?: string;
}

function classifyEmailErr(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('email_taken') || msg.includes('identifier_taken') || msg.includes('409')) {
    return ERROR_COPY.bindEmailTaken;
  }
  return ERROR_COPY.bindNetwork;
}

function classifyPhoneErr(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('phone_taken') || msg.includes('identifier_taken') || msg.includes('409')) {
    return ERROR_COPY.bindPhoneTaken;
  }
  if (msg.includes('code_invalid') || msg.includes('410')) {
    return ERROR_COPY.bindCodeInvalid;
  }
  if (msg.includes('password') || msg.includes('401')) {
    return ERROR_COPY.bindPasswordWrong;
  }
  return ERROR_COPY.bindNetwork;
}

export default function CompleteProfile() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('email');

  // Email tab state
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailDevLink, setEmailDevLink] = useState<string | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailErr, setEmailErr] = useState<FormError | null>(null);

  // Phone tab state
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [password, setPassword] = useState('');
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneErr, setPhoneErr] = useState<FormError | null>(null);

  const handleEmailSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailErr(null);
    if (!email.includes('@')) {
      toast.warn('邮箱格式有误');
      return;
    }
    setIsEmailSending(true);
    try {
      const resp = await api.post<SendResponse, { email: string }>(
        '/auth/bind/email/send-link',
        { email: email.trim() },
      );
      setEmailSent(true);
      setEmailDevLink(resp._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.complete.email.send.failed', { err: String(err) });
      const next = classifyEmailErr(err);
      setEmailErr(next);
      toast.error(next.title, next.description);
    } finally {
      setIsEmailSending(false);
    }
  };

  const handlePhoneSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPhoneErr(null);
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
    setIsPhoneSubmitting(true);
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
      toast.info(AUTH_COPY.bindPhone.successTitle);
      navigate('/', { replace: true });
    } catch (err) {
      logger.error('auth.complete.phone.failed', { err: String(err) });
      const next = classifyPhoneErr(err);
      setPhoneErr(next);
      toast.error(next.title, next.description);
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  const handleLogout = async () => {
    // commit #6j: 调 backend logout 清 httpOnly cookie, 失败也清前端 (跟
    // Profile.handleLogout 同模式).
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      logger.warn('auth.logout.backend_failed', { err: String(err) });
    }
    clearSession();
    navigate('/login');
  };

  const logoutButton = (
    <button
      type="button"
      onClick={() => { void handleLogout(); }}
      data-testid="complete-profile-logout"
      className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1 transition-colors duration-fast ease-motion"
    >
      <LogoutIcon className="w-3.5 h-3.5" />
      退出
    </button>
  );

  return (
    <AuthShell
      testId="complete-profile-view"
      maxWidthClass="max-w-[440px]"
      rightSlot={logoutButton}
    >
        <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
          {AUTH_COPY.completeProfile.title}
        </h1>
        <p className="text-base text-ink-3 mb-6">{AUTH_COPY.completeProfile.subtitle}</p>

        <div className="flex gap-2 mb-6 border-b border-line">
          <button
            type="button"
            onClick={() => setTab('email')}
            data-testid="complete-tab-email"
            className={`pb-2 px-1 text-sm font-medium transition-colors ${
              tab === 'email'
                ? 'text-ink border-b-2 border-ink -mb-px'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {AUTH_COPY.completeProfile.emailTab}
          </button>
          <button
            type="button"
            onClick={() => setTab('phone')}
            data-testid="complete-tab-phone"
            className={`pb-2 px-1 text-sm font-medium transition-colors ${
              tab === 'phone'
                ? 'text-ink border-b-2 border-ink -mb-px'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {AUTH_COPY.completeProfile.phoneTab}
          </button>
        </div>

        {tab === 'email' ? (
          emailSent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink">{AUTH_COPY.bindEmail.sentTitle}</p>
              <p className="text-sm text-ink-3 leading-relaxed">{AUTH_COPY.bindEmail.sentDesc}</p>
              {emailDevLink !== null ? (
                <div
                  data-testid="complete-email-dev-link"
                  className="px-3 py-2 border border-line border-dashed rounded-card text-xs text-ink-3 break-all font-mono"
                >
                  {`${window.location.origin}/bind-email?token=${emailDevLink}`}
                </div>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleEmailSend} className="flex flex-col gap-4" noValidate>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <div>
                <label
                  id="complete-email-label"
                  htmlFor="complete-email"
                  className="block mb-2 text-sm font-medium text-ink"
                >
                  {AUTH_COPY.bindEmail.emailLabel}
                </label>
                <input
                  id="complete-email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="complete-email-input"
                  aria-labelledby="complete-email-label"
                  className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
              </div>
              {emailErr !== null ? (
                <div
                  role="alert"
                  data-testid="complete-email-error"
                  className="flex items-start gap-2 px-3 py-2 border border-err rounded-card text-sm text-ink"
                >
                  <AlertCircleIcon className="w-4 h-4 mt-1 text-err shrink-0" />
                  <div>
                    <div className="font-semibold">{emailErr.title}</div>
                    {emailErr.description !== undefined ? (
                      <div className="text-xs text-ink-3 mt-1">{emailErr.description}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={isEmailSending}
                data-testid="complete-email-submit"
                className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
              >
                {isEmailSending ? AUTH_COPY.bindEmail.sendingButton : AUTH_COPY.bindEmail.sendButton}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4" noValidate>
            {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
            <div>
              <label
                id="complete-phone-label"
                htmlFor="complete-phone"
                className="block mb-2 text-sm font-medium text-ink"
              >
                {AUTH_COPY.bindPhone.phoneLabel}
              </label>
              <input
                id="complete-phone"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="138 0013 8000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="complete-phone-input"
                aria-labelledby="complete-phone-label"
                className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
              />
            </div>
            <div>
              <label
                id="complete-phone-code-label"
                htmlFor="complete-phone-code"
                className="block mb-2 text-sm font-medium text-ink"
              >
                {AUTH_COPY.bindPhone.codeLabel}
              </label>
              <div className="flex gap-2 items-stretch">
                <input
                  id="complete-phone-code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位数字"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  data-testid="complete-phone-code"
                  aria-labelledby="complete-phone-code-label"
                  className="flex-1 min-w-0 px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
                />
                <SendCodeButton phone={phone} purpose="bind_phone" />
              </div>
            </div>
            <div>
              <label
                id="complete-phone-password-label"
                htmlFor="complete-phone-password"
                className="block mb-2 text-sm font-medium text-ink"
              >
                {AUTH_COPY.bindPhone.passwordLabel}
              </label>
              <input
                id="complete-phone-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="complete-phone-password"
                aria-labelledby="complete-phone-password-label"
                className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
              />
            </div>
            {phoneErr !== null ? (
              <div
                role="alert"
                data-testid="complete-phone-error"
                className="flex items-start gap-2 px-3 py-2 border border-err rounded-card text-sm text-ink"
              >
                <AlertCircleIcon className="w-4 h-4 mt-1 text-err shrink-0" />
                <div>
                  <div className="font-semibold">{phoneErr.title}</div>
                  {phoneErr.description !== undefined ? (
                    <div className="text-xs text-ink-3 mt-1">{phoneErr.description}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isPhoneSubmitting}
              data-testid="complete-phone-submit"
              className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
            >
              {isPhoneSubmitting ? AUTH_COPY.bindPhone.submittingButton : AUTH_COPY.bindPhone.submitButton}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-ink-3 text-center leading-relaxed">
          {AUTH_COPY.completeProfile.skipNote}
        </p>
    </AuthShell>
  );
}
