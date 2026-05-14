import { useLocation, useNavigate } from 'react-router-dom';
import { LockIcon } from '@sikao/ui/icons';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { AUTH_COPY } from '@/lib/ui-copy';

// AuthFallbackEmptyState — 认证失败 (401 / 403) 时的视觉兜底.
//
// P4 audit P0-3: visual-mock 模式或 cookie 过期但 localStorage user 仍在
// 的边缘态下, Papers / Dashboard / WrongBook 等 query view 直接显示空白
// main, 用户看到冷屏 (RedirectGuard re-evaluate 与 view re-render 之间
// 有几帧时序窗口, 或 query 报 401 但 user UI state 还没清).
//
// 这里统一走 "请先登录" + "登录" CTA, 跟现有 EmptyState (tone='muted')
// 调性一致 (ink-first / 不打鸡血). 不 auto-redirect — 必须用户 click 触发,
// 避免 silent navigate 让用户失去上下文.
//
// 跳转走 location.state.from (跟 RedirectGuard / Login.tsx 既有约定一致),
// 登录成功后 Login.tsx 会 navigate(from).

export interface AuthFallbackEmptyStateProps {
  /** 自定义文案, 默认 AUTH_COPY.fallback. */
  readonly title?: string;
  readonly description?: string;
  /** 登录后跳回目标, 默认当前 location pathname. */
  readonly redirectTo?: string;
  readonly className?: string;
}

export function AuthFallbackEmptyState({
  title,
  description,
  redirectTo,
  className,
}: AuthFallbackEmptyStateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogin = (): void => {
    const target = redirectTo ?? `${location.pathname}${location.search}`;
    navigate('/login', { state: { from: target } });
  };

  return (
    <div data-testid="auth-fallback-empty-state" className={className}>
      <EmptyState
        icon={<LockIcon className="w-8 h-8" aria-hidden="true" />}
        title={title ?? AUTH_COPY.fallback.title}
        description={description ?? AUTH_COPY.fallback.description}
        action={
          <Button
            variant="primary"
            onClick={handleLogin}
            data-testid="auth-fallback-login-cta"
          >
            前往登录
          </Button>
        }
      />
    </div>
  );
}
