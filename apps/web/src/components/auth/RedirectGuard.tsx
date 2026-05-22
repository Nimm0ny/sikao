import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

// Phase 5.6b — 路由级 auth guard wrapper。两种 mode：
//
//   require-auth      : 未登录 → 跳 /login（带 from 参数，登录后回来）
//   redirect-if-authed: 已登录 → 跳 /（避免已登录用户再看 Marketing 首屏）
//
// 用法（router/index.tsx）：
//   { path: '/', element: <RedirectGuard mode="redirect-if-authed"><Marketing /></RedirectGuard> }
//   { path: 'app', element: <RedirectGuard mode="require-auth"><Home /></RedirectGuard> }
//
// 不用 react-router loader / middleware —— 它们在这个项目还不是主流模式；
// 用 wrapper 显式直观。

export type RedirectGuardMode = 'require-auth' | 'redirect-if-authed';

export interface RedirectGuardProps {
  readonly mode: RedirectGuardMode;
  readonly children: ReactNode;
  /** 覆盖默认跳转目标。默认 require-auth → /login，redirect-if-authed → /。 */
  readonly redirectTo?: string;
}

export function RedirectGuard({ mode, children, redirectTo }: RedirectGuardProps) {
  // P1 review fix Phase B.4b: 去掉 localStorage token field 后, 鉴权信号
  // 改读 user (cookie auth 由 axios withCredentials + 后端 dependency 处理).
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const isAuthed = user !== null;

  if (mode === 'require-auth' && !isAuthed) {
    const target = redirectTo ?? '/login';
    // 记录来源，登录页可读取并在登录后回跳。
    return <Navigate to={target} replace state={{ from: location.pathname }} />;
  }
  if (mode === 'redirect-if-authed' && isAuthed) {
    return <Navigate to={redirectTo ?? '/'} replace />;
  }
  // commit #6i (Identity v2): 老 user (email 与 phone 都 NULL, 仅 username_legacy)
  // 强制走 /complete-profile 补全至少一个 identifier. backend 派生 needsIdentifier
  // Setup=True (D6/D7, 90 天 deprecation). 例外: /complete-profile 自身不能再
  // redirect 否则死循环; logout / 登出后清 store 会让该 guard 失效.
  if (
    mode === 'require-auth'
    && isAuthed
    && user.needsIdentifierSetup === true
    && location.pathname !== '/complete-profile'
  ) {
    return <Navigate to="/complete-profile" replace />;
  }
  return <>{children}</>;
}
