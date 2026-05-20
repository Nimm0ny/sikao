import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon, StatusDoneIcon } from '@sikao/ui/icons';
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

function FormErrorStrip({ error }: { readonly error: FormError }) {
  return (
    <div
      role="alert"
      data-testid="bind-phone-form-error"
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

export default function BindPhone() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const user = useAuthStore((state) => state.user);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
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
    setIsSubmitting(true);
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
      setConfirmed(true);
      toast.info(AUTH_COPY.bindPhone.successTitle);
      navigate('/profile', { replace: true });
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
    <AuthShell testId="bind-phone-view" maxWidthClass="max-w-[440px]">
      {confirmed ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.bindPhone.successTitle}
          description={AUTH_COPY.bindPhone.successDesc}
          tone="success"
        >
          <Link
            to="/profile"
            className="text-sm text-accent hover:underline underline-offset-2"
          >
            {AUTH_COPY.bindPhone.backToProfile}
          </Link>
        </AuthStatusState>
      ) : (
        <>
          <AuthPanelIntro
            eyebrow={AUTH_COPY.bindPhone.eyebrow}
            title={AUTH_COPY.bindPhone.title}
            subtitle={AUTH_COPY.bindPhone.subtitle}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <FieldStack
              id="bind-phone-phone"
              label={AUTH_COPY.bindPhone.phoneLabel}
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              placeholder="138 0013 8000"
              value={phone}
              onChange={setPhone}
              testId="bind-phone-phone"
            />
            <FieldStack
              id="bind-phone-code"
              label={AUTH_COPY.bindPhone.codeLabel}
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder={AUTH_COPY.bindPhone.codePlaceholder}
              value={smsCode}
              onChange={setSmsCode}
              testId="bind-phone-code"
              rightSlot={<SendCodeButton phone={phone} purpose="bind_phone" />}
              hint={AUTH_COPY.bindPhone.codeHint}
            />
            <FieldStack
              id="bind-phone-password"
              label={AUTH_COPY.bindPhone.passwordLabel}
              type="password"
              autoComplete="current-password"
              placeholder={AUTH_COPY.bindPhone.passwordPlaceholder}
              value={password}
              onChange={setPassword}
              testId="bind-phone-password"
            />

            {formError !== null ? <FormErrorStrip error={formError} /> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="bind-phone-submit"
              className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? AUTH_COPY.bindPhone.submittingButton : AUTH_COPY.bindPhone.submitButton}
            </button>
          </form>

          <div className="mt-8 border-t border-line pt-6 text-center">
            <Link
              to="/profile"
              className="text-sm text-accent hover:underline underline-offset-2"
            >
              {AUTH_COPY.bindPhone.backToProfile}
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
