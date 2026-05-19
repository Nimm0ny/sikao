import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon, LogoutIcon, StatusDoneIcon } from '@sikao/ui/icons';
import { AuthPanelIntro } from '@/components/auth/AuthPanelIntro';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthStatusState } from '@/components/auth/AuthStatusState';
import { FieldStack } from '@/components/auth/FieldStack';
import SendCodeButton from '@/components/auth/SendCodeButton';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';

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

function FormErrorStrip({
  error,
  testId,
}: {
  readonly error: FormError;
  readonly testId: string;
}) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className="flex items-start gap-2 rounded-card border border-err px-3 py-2 text-sm text-ink"
    >
      <AlertCircleIcon className="mt-1 h-4 w-4 shrink-0 text-err" />
      <div>
        <div className="font-semibold">{error.title}</div>
        {error.description !== undefined ? (
          <div className="mt-1 text-xs text-ink-3">{error.description}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function CompleteProfile() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>('email');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailDevLink, setEmailDevLink] = useState<string | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailErr, setEmailErr] = useState<FormError | null>(null);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [password, setPassword] = useState('');
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneErr, setPhoneErr] = useState<FormError | null>(null);
  const [phoneCompleted, setPhoneCompleted] = useState(false);

  const handleEmailSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailErr(null);
    if (!email.includes('@')) {
      toast.warn(AUTH_COPY.bindEmail.emailInvalidWarn);
      return;
    }
    setIsEmailSending(true);
    try {
      const response = await api.post<SendResponse, { email: string }>(
        '/auth/bind/email/send-link',
        { email: email.trim() },
      );
      setEmailSent(true);
      setEmailDevLink(response._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.complete.email.send.failed', { err: String(err) });
      const next = classifyEmailErr(err);
      setEmailErr(next);
      toast.error(next.title, next.description);
    } finally {
      setIsEmailSending(false);
    }
  };

  const handlePhoneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhoneErr(null);
    if (phone.trim().length < 11) {
      toast.warn(AUTH_COPY.bindPhone.phoneInvalidWarn);
      return;
    }
    if (!/^\d{6}$/.test(smsCode)) {
      toast.warn(AUTH_COPY.bindPhone.codeInvalidWarn);
      return;
    }
    if (password.length < 6) {
      toast.warn(AUTH_COPY.bindPhone.passwordRequiredWarn);
      return;
    }
    setIsPhoneSubmitting(true);
    try {
      const response = await api.post<
        { ok: true; user: AuthUserSummary },
        { phone: string; smsCode: string; password: string }
      >('/auth/bind/phone/confirm', {
        phone: phone.trim(),
        smsCode,
        password,
      });
      if (user !== null) {
        setSession({ ...user, ...response.user }, 0);
      }
      setPhoneCompleted(true);
      toast.info(AUTH_COPY.bindPhone.successTitle);
      window.setTimeout(() => navigate('/app', { replace: true }), 1500);
    } catch (err) {
      logger.error('auth.complete.phone.failed', { err: String(err) });
      const next = classifyPhoneErr(err);
      setPhoneErr(next);
      toast.error(next.title, next.description);
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
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
      onClick={() => {
        void handleLogout();
      }}
      data-testid="complete-profile-logout"
      className="inline-flex items-center gap-2 rounded-tiny border border-line bg-paper-2 px-3 py-2 font-mono text-tiny tracking-eyebrow text-ink-3 transition-colors duration-fast ease-motion hover:text-ink"
    >
      <LogoutIcon className="h-3.5 w-3.5" />
      {AUTH_COPY.completeProfile.logoutAction}
    </button>
  );

  return (
    <AuthShell
      testId="complete-profile-view"
      maxWidthClass="max-w-[460px]"
      rightSlot={logoutButton}
    >
      {phoneCompleted ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.bindPhone.successTitle}
          description={AUTH_COPY.bindPhone.successDesc}
          tone="success"
        />
      ) : (
        <>
          <AuthPanelIntro
            eyebrow={AUTH_COPY.completeProfile.eyebrow}
            title={AUTH_COPY.completeProfile.title}
            subtitle={AUTH_COPY.completeProfile.subtitle}
          />

          <div className="mb-8 rounded-card border border-line bg-paper-2 p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setTab('email')}
                data-testid="complete-tab-email"
                className={`rounded-tiny px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-motion ${
                  tab === 'email'
                    ? 'bg-paper text-ink shadow-card'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {AUTH_COPY.completeProfile.emailTab}
              </button>
              <button
                type="button"
                onClick={() => setTab('phone')}
                data-testid="complete-tab-phone"
                className={`rounded-tiny px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-fast ease-motion ${
                  tab === 'phone'
                    ? 'bg-paper text-ink shadow-card'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {AUTH_COPY.completeProfile.phoneTab}
              </button>
            </div>
          </div>

          {tab === 'email' ? (
            emailSent ? (
              <AuthStatusState
                icon={<StatusDoneIcon className="h-5 w-5" />}
                title={AUTH_COPY.bindEmail.sentTitle}
                description={AUTH_COPY.bindEmail.sentDesc}
                tone="success"
              >
                {emailDevLink !== null ? (
                  <div
                    data-testid="complete-email-dev-link"
                    className="w-full rounded-card border border-dashed border-line bg-paper-2 px-3 py-2 text-left font-mono text-xs break-all text-ink-3"
                  >
                    {`${window.location.origin}/bind-email?token=${emailDevLink}`}
                  </div>
                ) : null}
              </AuthStatusState>
            ) : (
              <form onSubmit={handleEmailSend} className="flex flex-col gap-5" noValidate>
                <FieldStack
                  id="complete-email"
                  label={AUTH_COPY.bindEmail.emailLabel}
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={setEmail}
                  testId="complete-email-input"
                />

                {emailErr !== null ? (
                  <FormErrorStrip error={emailErr} testId="complete-email-error" />
                ) : null}

                <button
                  type="submit"
                  disabled={isEmailSending}
                  data-testid="complete-email-submit"
                  className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isEmailSending ? AUTH_COPY.bindEmail.sendingButton : AUTH_COPY.bindEmail.sendButton}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-5" noValidate>
              <FieldStack
                id="complete-phone"
                label={AUTH_COPY.bindPhone.phoneLabel}
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="138 0013 8000"
                value={phone}
                onChange={setPhone}
                testId="complete-phone-input"
              />
              <FieldStack
                id="complete-phone-code"
                label={AUTH_COPY.bindPhone.codeLabel}
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder={AUTH_COPY.bindPhone.codePlaceholder}
                value={smsCode}
                onChange={setSmsCode}
                testId="complete-phone-code"
                rightSlot={<SendCodeButton phone={phone} purpose="bind_phone" />}
                hint={AUTH_COPY.bindPhone.codeHint}
              />
              <FieldStack
                id="complete-phone-password"
                label={AUTH_COPY.bindPhone.passwordLabel}
                type="password"
                autoComplete="current-password"
                placeholder={AUTH_COPY.bindPhone.passwordPlaceholder}
                value={password}
                onChange={setPassword}
                testId="complete-phone-password"
              />

              {phoneErr !== null ? (
                <FormErrorStrip error={phoneErr} testId="complete-phone-error" />
              ) : null}

              <button
                type="submit"
                disabled={isPhoneSubmitting}
                data-testid="complete-phone-submit"
                className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPhoneSubmitting ? AUTH_COPY.bindPhone.submittingButton : AUTH_COPY.bindPhone.submitButton}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-xs leading-relaxed text-ink-3">
            {AUTH_COPY.completeProfile.skipNote}
          </p>
        </>
      )}
    </AuthShell>
  );
}
