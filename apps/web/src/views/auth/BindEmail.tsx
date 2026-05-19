import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircleIcon, StatusDoneIcon } from '@sikao/ui/icons';
import { AuthPanelIntro } from '@/components/auth/AuthPanelIntro';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthStatusState } from '@/components/auth/AuthStatusState';
import { FieldStack } from '@/components/auth/FieldStack';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';

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

export default function BindEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const user = useAuthStore((state) => state.user);
  const token = searchParams.get('token') ?? '';
  const isConfirmStep = token !== '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentDevLink, setSentDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!email.includes('@')) {
      toast.warn(AUTH_COPY.bindEmail.emailInvalidWarn);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post<SendResponse, { email: string }>(
        '/auth/bind/email/send-link',
        { email: email.trim() },
      );
      setSent(true);
      setSentDevLink(response._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.bind.email.send.failed', { err: String(err) });
      const next = classifyBindError(err, 'send');
      setFormError(next);
      toast.error(next.title, next.description);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (password.length < 6) {
      toast.warn(AUTH_COPY.bindEmail.passwordRequiredWarn);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post<
        { ok: true; user: AuthUserSummary },
        { token: string; password: string }
      >('/auth/bind/email/confirm', {
        token,
        password,
      });
      if (user !== null) {
        setSession({ ...user, ...response.user }, 0);
      }
      setConfirmed(true);
      toast.info(AUTH_COPY.bindEmail.successTitle);
      window.setTimeout(() => navigate('/profile', { replace: true }), 1500);
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
    <AuthShell testId="bind-email-view" maxWidthClass="max-w-[440px]">
      {confirmed ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.bindEmail.successTitle}
          description={AUTH_COPY.bindEmail.successDesc}
          tone="success"
        >
          <Link
            to="/profile"
            className="text-sm text-accent hover:underline underline-offset-2"
          >
            {AUTH_COPY.bindEmail.backToProfile}
          </Link>
        </AuthStatusState>
      ) : sent && !isConfirmStep ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.bindEmail.sentTitle}
          description={AUTH_COPY.bindEmail.sentDesc}
          tone="success"
        >
          {sentDevLink !== null ? (
            <div
              data-testid="bind-email-dev-link"
              className="w-full rounded-card border border-dashed border-line bg-paper-2 px-3 py-2 text-left font-mono text-xs break-all text-ink-3"
            >
              {`${window.location.origin}/bind-email?token=${sentDevLink}`}
            </div>
          ) : null}
          <div className="mt-4">
            <Link
              to="/profile"
              className="text-sm text-accent hover:underline underline-offset-2"
            >
              {AUTH_COPY.bindEmail.backToProfile}
            </Link>
          </div>
        </AuthStatusState>
      ) : isConfirmStep ? (
        <>
          <AuthPanelIntro
            eyebrow={AUTH_COPY.bindEmail.confirmEyebrow}
            title={AUTH_COPY.bindEmail.confirmTitle}
            subtitle={AUTH_COPY.bindEmail.confirmSubtitle}
          />

          <form onSubmit={handleConfirm} className="flex flex-col gap-5" noValidate>
            <FieldStack
              id="bind-email-confirm-password"
              label={AUTH_COPY.bindEmail.passwordLabel}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              testId="bind-email-password"
              placeholder={AUTH_COPY.bindEmail.passwordPlaceholder}
            />

            {formError !== null ? (
              <FormErrorStrip error={formError} testId="bind-email-form-error" />
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="bind-email-confirm-submit"
              className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? AUTH_COPY.bindEmail.confirmingButton : AUTH_COPY.bindEmail.confirmButton}
            </button>
          </form>
        </>
      ) : (
        <>
          <AuthPanelIntro
            eyebrow={AUTH_COPY.bindEmail.sendEyebrow}
            title={AUTH_COPY.bindEmail.sendTitle}
            subtitle={AUTH_COPY.bindEmail.sendSubtitle}
          />

          <form onSubmit={handleSend} className="flex flex-col gap-5" noValidate>
            <FieldStack
              id="bind-email-email"
              label={AUTH_COPY.bindEmail.emailLabel}
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              value={email}
              onChange={setEmail}
              testId="bind-email-email"
            />

            {formError !== null ? (
              <FormErrorStrip error={formError} testId="bind-email-send-error" />
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="bind-email-send-submit"
              className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? AUTH_COPY.bindEmail.sendingButton : AUTH_COPY.bindEmail.sendButton}
            </button>
          </form>

          <div className="mt-8 border-t border-line pt-6 text-center">
            <Link
              to="/profile"
              className="text-sm text-accent hover:underline underline-offset-2"
            >
              {AUTH_COPY.bindEmail.backToProfile}
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
