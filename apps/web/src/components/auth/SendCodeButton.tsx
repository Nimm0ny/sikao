import { useState, useEffect, useRef } from 'react';
import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';

const COUNTDOWN_SECONDS = 60;

type SmsPurpose = 'register' | 'bind_phone';

interface SendCodeButtonProps {
  readonly phone: string;
  readonly purpose: SmsPurpose;
  readonly disabled?: boolean;
  readonly testId?: string;
}

// commit #6i: bind_phone 走独立 endpoint /auth/bind/phone/send-code (logged-in
// only). 公共 /auth/sms/send-code 拦 purpose=bind_phone (后端 line 394). 这里
// 按 purpose dispatch endpoint, payload shape 不同 (公共端 含 purpose 字段, bind
// 端 只 phone).
function endpointFor(purpose: SmsPurpose): string {
  return purpose === 'bind_phone' ? '/auth/bind/phone/send-code' : '/auth/sms/send-code';
}

interface SendCodeResponse {
  readonly ok: true;
  // dev gate `dev_expose_magic_code` 控制 prod 不暴露; 本 button 不消费,
  // 留给 future 自动填充测试 helper.
  readonly _devMagicCode?: string | null;
}

// SMS verification code button. Click → POST /auth/sms/send-code,
// 60s 倒计时禁用 + 文案 "Ns 后重发". 服务端限流 (D13, fastapi-limiter)
// 命中返 429 → ERROR_COPY.registerSmsRateLimit toast.
export default function SendCodeButton({
  phone,
  purpose,
  disabled = false,
  testId = 'send-code-button',
}: SendCodeButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startCountdown = () => {
    setSecondsLeft(COUNTDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (phone.trim().length < 11) {
      toast.warn(AUTH_COPY.sendCode.phoneInvalidWarn);
      return;
    }
    setIsSending(true);
    try {
      const endpoint = endpointFor(purpose);
      const body =
        purpose === 'bind_phone'
          ? { phone: phone.trim() }
          : { phone: phone.trim(), purpose };
      await api.post<SendCodeResponse, typeof body>(endpoint, body);
      toast.info(AUTH_COPY.sendCode.sentTitle, AUTH_COPY.sendCode.sentDesc);
      startCountdown();
    } catch (err) {
      logger.error('auth.sms.send-code.failed', { phone, err: String(err) });
      const msg = String(err);
      if (msg.includes('429')) {
        toast.error(
          ERROR_COPY.registerSmsRateLimit.title,
          ERROR_COPY.registerSmsRateLimit.description,
        );
      } else {
        toast.error(AUTH_COPY.sendCode.sendFailedTitle, AUTH_COPY.sendCode.sendFailedDesc);
      }
    } finally {
      setIsSending(false);
    }
  };

  const isCountingDown = secondsLeft > 0;
  const canClick = !disabled && !isSending && !isCountingDown && phone.trim().length >= 11;

  let label: string;
  if (isSending) {
    label = '发送中…';
  } else if (isCountingDown) {
    label = `${secondsLeft}s 后重发`;
  } else {
    label = '发送验证码';
  }

  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={handleSend}
      data-testid={testId}
      className="pv-btn shrink-0 px-4 py-3 bg-surface text-ink text-sm font-medium border border-line-3 rounded-card hover:border-line-3 hover:scale-[1.03] active:scale-[0.98] disabled:bg-surface-alt disabled:text-ink-3 disabled:cursor-not-allowed disabled:border-line disabled:hover:scale-100 disabled:hover:border-line transition-[border-color,transform] duration-base ease-motion whitespace-nowrap"
    >
      {label}
    </button>
  );
}
