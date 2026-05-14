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
import SendCodeButton from '@/components/auth/SendCodeButton';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';

interface FormError {
  readonly title: string;
  readonly description?: string;
}

function classifyRegisterError(err: unknown): FormError {
  const msg = String(err);
  if (msg.includes('phone_taken') || msg.includes('409')) {
    return ERROR_COPY.registerPhoneTaken;
  }
  if (msg.includes('code_invalid') || msg.includes('410')) {
    return ERROR_COPY.registerCodeInvalid;
  }
  if (msg.includes('422') || msg.includes('weak')) return ERROR_COPY.registerWeak;
  return ERROR_COPY.registerNetwork;
}

interface LoginResponseV2 {
  readonly tokenType: 'bearer';
  readonly expiresIn: number;
  readonly user: AuthUserSummary;
}

// SIKAO Redesign Wave 1 · 01c RegisterPhone (2026-05-11).
// 视觉: hifi 二段式 (左 ink art + 右 paper form) — AuthSplitLayout 包.
// 业务: phone + smsCode (6 位) + password → /auth/register/phone,
// verify-then-write (短信先验). normalize_phone 由后端处理.
export default function RegisterPhone() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormError | null>(null);

  // Wave 4 X2 verify P1: sub 文案 wire useNationalExamCountdown — BE
  // /exam-events 全集 filter category=='national' 升序 first (跟 Login 一致).
  // loading / error / 空集 退 hardcode 兜底; days<0 切回原文案.
  const { examLabel, daysUntil } = useNationalExamCountdown();
  const subCopy =
    daysUntil >= 0
      ? `距 ${examLabel}还有 ${daysUntil} 天 · 中国大陆手机号，一次发码 10 分钟内有效。`
      : '中国大陆手机号，一次发码 10 分钟内有效。';

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
      toast.warn('密码至少 6 个字符');
      return;
    }
    setIsSubmitting(true);
    let response: LoginResponseV2 | null = null;
    try {
      response = await api.post<
        LoginResponseV2,
        { phone: string; smsCode: string; password: string }
      >('/auth/register/phone', {
        phone: phone.trim(),
        smsCode,
        password,
      });
    } catch (err) {
      logger.error('auth.register.phone.failed', { phone, err: String(err) });
      const next = classifyRegisterError(err);
      setFormError(next);
      toast.error(next.title, next.description);
      return;
    } finally {
      setIsSubmitting(false);
    }
    if (response === null) throw new Error('auth.register.phone missing response');
    setSession(response.user, response.expiresIn);
    toast.info('注册成功', '欢迎加入思考');
    navigate('/app', { replace: true });
  };

  return (
    <AuthSplitLayout testId="register-phone-view">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="font-mono text-tiny tracking-eyebrow uppercase text-ink-3 mb-3">
          SIGN UP · PHONE
        </div>
        {/* Wave 9 Phase 1 responsive: mobile (≤768) text-h-section 28px 防 375px
            viewport 上 42px 撑爆; md+ tablet/desktop text-h-mkt 42px 还原 hifi. */}
        <h1 className="font-serif text-h-section md:text-h-mkt font-medium text-ink mb-2">开始你的备考。</h1>
        <p className="text-sm text-ink-3 mb-8" data-testid="register-phone-sub">
          {subCopy}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <FieldStack
            id="reg-phone-phone"
            label="手机号"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="138 0013 8000"
            value={phone}
            onChange={setPhone}
            testId="register-phone-phone"
          />
          <FieldStack
            id="reg-phone-code"
            label="验证码"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位数字"
            value={smsCode}
            onChange={setSmsCode}
            testId="register-phone-code"
            rightSlot={<SendCodeButton phone={phone} purpose="register" />}
            hint="发送后 60 秒内有效，未收到可重发。"
          />
          <FieldStack
            id="reg-phone-password"
            label="设置密码"
            type="password"
            autoComplete="new-password"
            placeholder="至少 6 位"
            value={password}
            onChange={setPassword}
            testId="register-phone-password"
          />

          {formError !== null ? (
            <div
              role="alert"
              data-testid="register-phone-form-error"
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
            data-testid="register-phone-submit"
            className="pv-btn w-full mt-2 py-3 px-6 bg-ink text-paper text-base font-medium rounded-tiny hover:bg-ink-1 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform] duration-base ease-motion"
          >
            {isSubmitting ? '创建中…' : '完成注册'}
          </button>
        </form>

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
            to="/register/email"
            className="text-accent hover:underline underline-offset-2"
          >
            改用邮箱注册
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
