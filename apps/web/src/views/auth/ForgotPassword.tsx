import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusDoneIcon } from '@sikao/ui/icons';
import { AuthShell } from '@/components/auth/AuthShell';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY } from '@/lib/ui-copy';

// Phase B.5a — Forgot password view.
//
// 后端 D5 silent-200: 不论 email 是否存在都返 {ok:true}. 故 UX 不暴露
// "邮箱不存在" 信息, 成功态文案中性 (AUTH_COPY.forgot.successTitle =
// "已尝试发送"). dev 模式 + APP_ENV=local + DEV_EXPOSE_MAGIC_LINK=true
// 时 body 含 _devMagicLink, 同 inline 显示给 dev/test (仅 dev gate 开
// 启时), 方便手拿 link 测 reset flow 不进邮箱.
//
// commit #5d: 视觉切 v1-minimal claude.com 风, 跟 5a/5b/5c 保持一致.

interface ForgotResponse {
  readonly ok: true;
  // P0-3 byte-identical: prod 时此字段缺失而非 null. 用 optional + ?? 兜底.
  readonly _devMagicLink?: string;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim() === '') {
      toast.warn('输入邮箱');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await api.post<ForgotResponse, { email: string }>(
        '/auth/forgot-password',
        { email: email.trim() },
      );
      // 不论后端是否找到 user, UX 一致: 显示成功提示. dev 模式额外显示
      // magic link inline 让 dev 跳过邮箱直接 reset.
      setSubmitted(true);
      setDevMagicLink(resp._devMagicLink ?? null);
    } catch (err) {
      logger.error('auth.forgot.failed', { err: String(err) });
      toast.error(AUTH_COPY.forgot.error);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell testId="forgot-view">
        <h1 className="text-2xl font-semibold text-ink mb-2 leading-tight">
          {AUTH_COPY.forgot.title}
        </h1>
        <p className="text-base text-ink-3 mb-8">{AUTH_COPY.forgot.subtitle}</p>

        {submitted ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 mb-5 bg-ok-bg text-ok rounded-pill flex items-center justify-center">
              <StatusDoneIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-ink mb-2">
              {AUTH_COPY.forgot.successTitle}
            </h2>
            <p className="text-sm text-ink-3 mb-6 leading-relaxed">
              {AUTH_COPY.forgot.successDesc}
            </p>
            {devMagicLink !== null ? (
              <div
                data-testid="forgot-dev-link"
                className="w-full px-3 py-2 mb-6 border border-line border-dashed rounded-card text-xs text-ink-3 break-all"
              >
                <span className="font-mono">{devMagicLink}</span>
              </div>
            ) : null}
            <Link
              to="/login"
              className="text-sm text-ink-3 hover:text-ink underline-offset-2 hover:underline transition-colors duration-fast ease-motion"
            >
              {AUTH_COPY.forgot.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              {/* a11y (chrome MCP audit 2026-05-13 P1): cross-node label/input W3C 标准,
                  但 axe-core scan 不识别 sibling htmlFor → 加 aria-labelledby 双绑兜底. */}
              <label
                id="forgot-email-label"
                htmlFor="forgot-email"
                className="block mb-2 text-sm font-medium text-ink"
              >
                {AUTH_COPY.forgot.emailLabel}
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="forgot-email"
                aria-labelledby="forgot-email-label"
                className="w-full px-4 py-3 bg-surface border border-line-3 rounded-card text-md text-ink placeholder:text-ink-4 hover:border-ink-3 focus:border-accent focus:ring-2 focus:ring-accent outline-none transition-colors"
              />
              <div className="mt-2 text-xs text-ink-3">{AUTH_COPY.forgot.emailHint}</div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="forgot-submit"
              className="pv-btn w-full mt-2 py-3 px-4 bg-ink text-white text-md font-semibold rounded-tiny hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:scale-100 transition-[background-color,transform] duration-base ease-motion"
            >
              {isSubmitting ? AUTH_COPY.forgot.submitting : AUTH_COPY.forgot.submit}
            </button>

            <div className="flex justify-center mt-2">
              <Link
                to="/login"
                className="text-sm text-ink-3 hover:text-ink underline-offset-2 hover:underline transition-colors duration-fast ease-motion"
              >
                {AUTH_COPY.forgot.backToLogin}
              </Link>
            </div>
          </form>
        )}
    </AuthShell>
  );
}
