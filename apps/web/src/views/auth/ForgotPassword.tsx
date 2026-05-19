import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusDoneIcon } from '@sikao/ui/icons';
import { AuthPanelIntro } from '@/components/auth/AuthPanelIntro';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthStatusState } from '@/components/auth/AuthStatusState';
import { FieldStack } from '@/components/auth/FieldStack';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

interface ForgotResponse {
  readonly ok: true;
  readonly _devMagicLink?: string;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim() === '') {
      toast.warn('输入邮箱');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post<ForgotResponse, { email: string }>(
        '/auth/forgot-password',
        { email: email.trim() },
      );
      setSubmitted(true);
      setDevMagicLink(response._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.forgot.failed', { err: String(err) });
      toast.error(AUTH_COPY.forgot.error);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell testId="forgot-view" maxWidthClass="max-w-[440px]">
      {submitted ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.forgot.successTitle}
          description={AUTH_COPY.forgot.successDesc}
          tone="success"
        >
          {devMagicLink !== null ? (
            <div
              data-testid="forgot-dev-link"
              className="w-full rounded-card border border-dashed border-line bg-paper-2 px-3 py-2 text-left font-mono text-xs break-all text-ink-3"
            >
              {devMagicLink}
            </div>
          ) : null}
          <div className="mt-4">
            <Link
              to="/login"
              className="text-sm text-accent hover:underline underline-offset-2"
            >
              {AUTH_COPY.forgot.backToLogin}
            </Link>
          </div>
        </AuthStatusState>
      ) : (
        <>
          <AuthPanelIntro
            eyebrow="PASSWORD RESET"
            title={AUTH_COPY.forgot.title}
            subtitle={AUTH_COPY.forgot.subtitle}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <FieldStack
              id="forgot-email"
              label={AUTH_COPY.forgot.emailLabel}
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              value={email}
              onChange={setEmail}
              testId="forgot-email"
              hint={AUTH_COPY.forgot.emailHint}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="forgot-submit"
              className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? AUTH_COPY.forgot.submitting : AUTH_COPY.forgot.submit}
            </button>

            <div className="mt-1 text-center">
              <Link
                to="/login"
                className="text-sm text-accent hover:underline underline-offset-2"
              >
                {AUTH_COPY.forgot.backToLogin}
              </Link>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  );
}
