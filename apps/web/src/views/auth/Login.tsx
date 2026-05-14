import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

function classifyLoginError(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('401') || msg.toLowerCase().includes('invalid')) {
    return ERROR_COPY.loginCredential;
  }
  return ERROR_COPY.loginNetwork;
}

interface LoginResponseV2 {
  readonly tokenType: 'bearer';
  readonly expiresIn: number;
  readonly user: AuthUserSummary;
}

interface LocationState {
  readonly from?: string;
}

// SIKAO Redesign Wave 1 · 01 Login (2026-05-11).
// 视觉: hifi 二段式 (左 ink art + 右 paper form) — AuthSplitLayout 包.
// 表单输入改 hifi .inp 风 (border-bottom only) + serif h2 欢迎回来.
// 业务: identifier (email/phone/legacy) + password → /auth/login.
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  const from = (location.state as LocationState | null)?.from ?? '/app';

  // Wave 1 Round 2: sub 文案带"距 N 国考还有 N 天" 实时计算. days<0
  // (考期已过) 切回"继续你的备考节奏。" 兜底.
  // Wave 4 X2: 真值走 useNationalExamCountdown — BE /exam-events 全集 filter
  // category=='national' 升序 first. loading / error / 空集 退 hardcode 兜底,
  // 避免 flash; error 走 toast (hook 内自动).
  const { examLabel, daysUntil } = useNationalExamCountdown();
  const subCopy =
    daysUntil >= 0
      ? `距 ${examLabel}还有 ${daysUntil} 天。`
      : '继续你的备考节奏。';

  // P2 落地: animationend 后剥离 .auth-anim-up class, 让 :hover transform 不被
  // animation-fill-mode:both 卡死的 transform 阻挡 (CSS animation cascade 优先级
  // 高于普通 :hover 声明). 详 docs/audit/login-redesign-2026-05-12/README.md.
  const viewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = viewRef.current;
    if (root === null) return;
    const handler = (e: AnimationEvent) => {
      if (e.animationName !== 'auth-fade-up') return;
      const target = e.target as HTMLElement | null;
      target?.classList.remove('auth-anim-up');
    };
    root.addEventListener('animationend', handler);
    return () => root.removeEventListener('animationend', handler);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (identifier.trim() === '' || password === '') {
      toast.warn('输入账号和密码');
      return;
    }
    setIsSubmitting(true);
    let response: LoginResponseV2 | null = null;
    try {
      response = await api.post<LoginResponseV2, { identifier: string; password: string }>(
        '/auth/login',
        { identifier: identifier.trim(), password },
      );
    } catch (err) {
      logger.error('auth.login.failed', { identifier, err: String(err) });
      const next = classifyLoginError(err);
      setFormError(next);
      toast.error(next.title, next.description);
      return;
    } finally {
      setIsSubmitting(false);
    }
    if (response === null) throw new Error('auth.login missing response');
    setSession(response.user, response.expiresIn);
    navigate(from, { replace: true });
  };

  return (
    <AuthSplitLayout testId="login-view">
      <div ref={viewRef} className="w-full max-w-[400px] mx-auto">
        <div className="auth-anim-up d-1 font-mono text-tiny tracking-eyebrow uppercase text-ink-3 mb-3">
          SIGN IN
        </div>
        {/* Wave 9 Phase 1 responsive: mobile (≤768) text-h-section 28px 防 375px
            viewport 上 42px 撑爆; md+ tablet/desktop text-h-mkt 42px 还原 hifi. */}
        <h1 className="auth-anim-up d-2 font-serif text-h-section md:text-h-mkt font-medium text-ink mb-2">欢迎回来。</h1>
        <p className="auth-anim-up d-2 text-sm text-ink-3 mb-8" data-testid="login-sub">
          {subCopy}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="auth-anim-up d-3">
            <FieldStack
              id="login-identifier"
              label="手机 / 邮箱 / 账号"
              type="text"
              autoComplete="username"
              placeholder="email@example.com"
              value={identifier}
              onChange={setIdentifier}
              testId="login-identifier"
            />
          </div>
          <div className="auth-anim-up d-4">
            <FieldStack
              id="login-password"
              label="密码"
              type="password"
              autoComplete="current-password"
              placeholder="输入密码"
              value={password}
              onChange={setPassword}
              testId="login-password"
            />
          </div>

          {formError !== null ? (
            <div
              role="alert"
              data-testid="login-form-error"
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

          {/* P2 button "浮出" hover: translateY(-3px) + scale(1.03) + shadow-pop.
              active 回 translateY(0) + scale(0.98), pv-btn 全局 80ms 急回弹. */}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="login-submit"
            className="auth-anim-up d-5 pv-btn w-full mt-2 py-3 px-6 bg-ink text-paper text-base font-medium rounded-tiny hover:bg-ink-1 hover:scale-[1.03] hover:-translate-y-[3px] hover:shadow-pop active:scale-[0.98] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform,box-shadow] duration-base ease-motion"
          >
            {isSubmitting ? '登录中…' : '登录'}
          </button>

          <div className="auth-anim-up d-5 flex justify-between text-xs text-ink-3 mt-1">
            <span>
              还没账号？
              <Link
                to="/register/phone"
                className="ml-1 text-accent hover:underline underline-offset-2"
              >
                用手机号注册
              </Link>
            </span>
            <Link
              to="/forgot-password"
              data-testid="login-forgot-link"
              className="text-accent hover:underline underline-offset-2"
            >
              忘记密码？
            </Link>
          </div>
        </form>

        {/* Wave 5C P2-2: 副 register CTA 在 mobile (≤640px) 纵排避免超 375 viewport.
            Wave 9 Phase 1: 收紧 breakpoint sm:→md: 跟 mobile-style-guide §1.3
            3 档对齐 (≤768=mobile 全纵排; ≥769=tablet/desktop 横排).
            P2 alt CTA 加 pv-btn + hover translateY + scale + shadow 跟主 CTA 同款"浮出"反馈. */}
        <div className="auth-anim-up d-6 mt-8 pt-6 border-t border-line flex flex-col gap-2 md:flex-row md:gap-3">
          <Link
            to="/register/email"
            className="pv-btn flex-1 inline-flex items-center justify-center px-4 py-3 border border-ink text-ink text-sm rounded-tiny hover:bg-paper-3 hover:scale-[1.03] hover:-translate-y-[3px] hover:shadow-card active:scale-[0.98] active:translate-y-0 transition-[background-color,transform,box-shadow] duration-base ease-motion"
          >
            用邮箱注册
          </Link>
          <Link
            to="/register/phone"
            className="pv-btn flex-1 inline-flex items-center justify-center px-4 py-3 border border-ink text-ink text-sm rounded-tiny hover:bg-paper-3 hover:scale-[1.03] hover:-translate-y-[3px] hover:shadow-card active:scale-[0.98] active:translate-y-0 transition-[background-color,transform,box-shadow] duration-base ease-motion"
          >
            用手机号注册
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
