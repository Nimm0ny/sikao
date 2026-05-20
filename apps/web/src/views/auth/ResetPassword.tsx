import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios, { type AxiosError } from 'axios';
import { AlertCircleIcon, StatusDoneIcon, WarningIcon } from '@sikao/ui/icons';
import { AuthPanelIntro } from '@/components/auth/AuthPanelIntro';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthStatusState } from '@/components/auth/AuthStatusState';
import { FieldStack } from '@/components/auth/FieldStack';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

interface ResetResponse {
  readonly ok: true;
}

interface ApiError {
  readonly detail?: string;
  readonly code?: string;
}

function isTokenInvalid(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const axiosError = err as AxiosError<ApiError>;
  return axiosError.response?.status === 410;
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
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
    <AuthShell testId="reset-view" maxWidthClass="max-w-[440px]">
      {tokenInvalid ? (
        <AuthStatusState
          icon={<WarningIcon className="h-5 w-5" />}
          title={AUTH_COPY.reset.expiredTitle}
          description={AUTH_COPY.reset.expiredDesc}
          tone="warning"
        >
          <Link
            to="/forgot-password"
            data-testid="reset-request-new"
            className="text-sm text-accent hover:underline underline-offset-2"
          >
            {AUTH_COPY.reset.requestNewLink}
          </Link>
        </AuthStatusState>
      ) : done ? (
        <AuthStatusState
          icon={<StatusDoneIcon className="h-5 w-5" />}
          title={AUTH_COPY.reset.successTitle}
          description={AUTH_COPY.reset.successDesc}
          tone="success"
        />
      ) : (
        <>
          <AuthPanelIntro
            eyebrow="PASSWORD RESET"
            title={AUTH_COPY.reset.title}
            subtitle={AUTH_COPY.reset.subtitle}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <FieldStack
              id="reset-new-password"
              label={AUTH_COPY.reset.newPasswordLabel}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              testId="reset-new-password"
              hint={AUTH_COPY.reset.newPasswordHint}
            />
            <FieldStack
              id="reset-confirm-password"
              label={AUTH_COPY.reset.confirmPasswordLabel}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              testId="reset-confirm-password"
              placeholder={AUTH_COPY.reset.confirmPasswordPlaceholder}
            />

            {formError !== null ? (
              <div
                role="alert"
                data-testid="reset-form-error"
                className="flex items-start gap-2 rounded-card border border-err px-3 py-2 text-sm text-ink"
              >
                <AlertCircleIcon className="mt-1 h-4 w-4 shrink-0 text-err" />
                <div>{formError}</div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="reset-submit"
              className="pv-btn mt-2 w-full rounded-tiny bg-ink px-6 py-3 text-base font-medium text-paper transition-[background-color,transform,box-shadow] duration-base ease-motion hover:-translate-y-[3px] hover:scale-[1.03] hover:bg-ink-1 hover:shadow-pop active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? AUTH_COPY.reset.submitting : AUTH_COPY.reset.submit}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
