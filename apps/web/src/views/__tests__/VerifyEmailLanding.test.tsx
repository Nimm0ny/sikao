import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import VerifyEmailLanding from '../auth/VerifyEmailLanding';

describe('VerifyEmailLanding', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, sessionExpiresAt: null });
    localStorage.clear();
  });

  it('loading state: mount immediately renders verify-loading testid before fetch resolves', async () => {
    // delay handler 让 fetch 长跑, 测 mount 后立即可见的 loading 态.
    server.use(
      http.post('/api/v2/auth/verify-email/confirm', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ ok: true });
      }),
    );
    renderWithProviders(<VerifyEmailLanding />, {
      initialEntries: ['/verify-email?token=valid-token-1234567890ab'],
    });

    // mount 后第一次 render 必是 loading
    expect(screen.getByTestId('verify-loading')).toBeInTheDocument();
  });

  it('happy path (logged-in): mount auto-confirms + shows success + 跳 /profile link', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'alice', displayName: 'Alice' },
      sessionExpiresAt: Date.now() + 3600_000,
    });
    renderWithProviders(<VerifyEmailLanding />, {
      initialEntries: ['/verify-email?token=valid-token-1234567890ab'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('verify-success')).toBeInTheDocument();
    });
    expect(screen.getByText('邮箱已验证')).toBeInTheDocument();
    // 已登录 → /profile link
    const link = screen.getByTestId('verify-success-link');
    expect(link).toHaveAttribute('href', '/profile');
    expect(link).toHaveTextContent('查看个人中心');
  });

  it('410 invalid token (logged-out): shows tone=error EmptyState + /login link', async () => {
    server.use(
      http.post('/api/v2/auth/verify-email/confirm', () =>
        HttpResponse.json(
          { detail: 'invalid or expired token', code: 'token_invalid' },
          { status: 410 },
        ),
      ),
    );
    renderWithProviders(<VerifyEmailLanding />, {
      initialEntries: ['/verify-email?token=expired-token-1234567890ab'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('verify-failed')).toBeInTheDocument();
    });
    expect(screen.getByText('验证链接已失效')).toBeInTheDocument();
    // 未登录 → /login link (commit #6j: 视觉切 v1-minimal AuthShell, 不再用
    // EmptyState role=alert; testid + text + link 即可断言失败态)
    const link = screen.getByTestId('verify-failed-link');
    expect(link).toHaveAttribute('href', '/login');
  });
});
