import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircleIcon } from '@sikao/ui/icons';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { FieldStack } from '@/components/auth/FieldStack';
import { api } from '@sikao/api-client/request';
import { useAuthStore, type AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { ERROR_COPY } from '@/lib/ui-copy';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';

interface FormError {
  readonly title: string;
  readonly description?: string;
}

function classifyRegisterError(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('email_taken') || msg.includes('409')) {
    return ERROR_COPY.registerEmailTaken;
  }
  if (msg.includes('422') || msg.includes('weak')) return ERROR_COPY.registerWeak;
  return ERROR_COPY.registerNetwork;
}

interface LoginResponseV2 {
  readonly tokenType: 'bearer';
  readonly expiresIn: number;
  readonly user: AuthUserSummary;
}

// SIKAO Redesign Wave 1 · 01b RegisterEmail (2026-05-11).
// 视觉: hifi 二段式 (左 ink art + 右 paper form) — AuthSplitLayout 包.
// 业务: email + displayName(opt) + password → /auth/register/email,
// write-then-verify (Phase B), 注册即可登录.
export default function RegisterEmail() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  // Wave 4 X2 verify P1: sub 文案 wire useNationalExamCountdown — BE
  // /exam-events 全集 filter category=='national' 升序 first (跟 Login 一致).
  // loading / error / 空集 退 hardcode 兜底; days<0 切回原文案.
  const { examLabel, daysUntil } = useNationalExamCountdown();
  const subCopy =
    daysUntil >= 0
      ? `距 ${examLabel}还有 ${daysUntil} 天 · 几秒搞定，用邮箱创建账号。`
      : '几秒搞定，用邮箱创建账号。';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!email.includes('@')) {
      toast.warn('邮箱格式有误');
      return;
    }
    if (password.length < 6) {
      toast.warn('密码至少 6 个字符');
      return;
    }
    setIsSubmitting(true);
    let response: LoginResponseV2 | null = null;
    try {
      response = await api.post<
        LoginResponseV2,
        { email: string; password: string; displayName?: string }
      >('/auth/register/email', {
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
    } catch (err) {
      logger.error('auth.register.email.failed', { email, err: String(err) });
      const next = classifyRegisterError(err);
      setFormError(next);
      toast.error(next.title, next.description);
      return;
    } finally {
      setIsSubmitting(false);
    }
    if (response === null) throw new Error('auth.register.email missing response');
    setSession(response.user, response.expiresIn);
    toast.info('注册成功', '欢迎加入思考');
    navigate('/app', { replace: true });
  };

  return (
    <AuthSplitLayout testId="register-email-view">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="font-mono text-tiny tracking-eyebrow uppercase text-ink-3 mb-3">
          SIGN UP · EMAIL
        </div>
        {/* Wave 9 Phase 1 responsive: mobile (≤768) text-h-section 28px 防 375px
            viewport 上 42px 撑爆; md+ tablet/desktop text-h-mkt 42px 还原 hifi. */}
        <h1 className="font-serif text-h-section md:text-h-mkt font-medium text-ink mb-2">开始你的备考。</h1>
        <p className="text-sm text-ink-3 mb-8" data-testid="register-email-sub">
          {subCopy}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <FieldStack
            id="reg-email-email"
            label="邮箱"
            type="email"
            autoComplete="email"
            placeholder="email@example.com"
            value={email}
            onChange={setEmail}
            testId="register-email-email"
          />
          <FieldStack
            id="reg-email-display-name"
            label="显示名 (可选)"
            type="text"
            autoComplete="nickname"
            placeholder="留空自动用邮箱前缀"
            value={displayName}
            onChange={setDisplayName}
            testId="register-email-display-name"
          />
          <FieldStack
            id="reg-email-password"
            label="密码"
            type="password"
            autoComplete="new-password"
            placeholder="至少 6 位"
            value={password}
            onChange={setPassword}
            testId="register-email-password"
          />

          {formError !== null ? (
            <div
              role="alert"
              data-testid="register-email-form-error"
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
            data-testid="register-email-submit"
            className="pv-btn w-full mt-2 py-3 px-6 bg-ink text-paper text-base font-medium rounded-tiny hover:bg-ink-1 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform] duration-base ease-motion"
          >
            {isSubmitting ? '创建中…' : '创建账号'}
          </button>
        </form>

        <p className="mt-5 text-xs text-ink-3 text-center leading-relaxed">
          创建账号即视为同意《用户协议》与《隐私政策》。
        </p>

        {/* Wave 5C P2-2: footer link 区在 mobile (≤640px) 纵排避免在 375 viewport
            justify-between 拉得过宽. Wave 9 Phase 1: 收紧 breakpoint sm:→md:
            跟 mobile-style-guide §1.3 3 档对齐 (≤768=mobile 全纵排). */}
        <div className="mt-8 pt-6 border-t border-line flex flex-col gap-2 text-xs text-ink-3 md:flex-row md:justify-between md:gap-4">
          <span>
            已有账号？
            <Link
              to="/login"
              className="ml-1 text-accent hover:underline underline-offset-2"
            >
              直接登录
            </Link>
          </span>
          <Link
            to="/register/phone"
            className="text-accent hover:underline underline-offset-2"
          >
            改用手机注册
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
