import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { AUTH_COPY } from '@/lib/ui-copy';
import BindEmail from '../auth/BindEmail';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

describe('BindEmail', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useAuthStore.setState({
      user: { id: 1, username: 'alice', displayName: 'Alice', email: null, phone: null },
      sessionExpiresAt: null,
    });
    localStorage.clear();
  });

  it('send step: shows sent state and inline dev link after request succeeds', async () => {
    server.use(
      http.post('/api/v2/auth/bind/email/send-link', () =>
        HttpResponse.json({ ok: true, _devMagicLink: 'bind-email-token-123' }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<BindEmail />, { initialEntries: ['/bind-email'] });

    await user.type(screen.getByTestId('bind-email-email'), 'alice@example.com');
    await user.click(screen.getByTestId('bind-email-send-submit'));

    expect(await screen.findByText(AUTH_COPY.bindEmail.sentTitle)).toBeInTheDocument();
    expect(screen.getByTestId('bind-email-dev-link')).toHaveTextContent(
      '/bind-email?token=bind-email-token-123',
    );
  });

  it('confirm step: updates session email and redirects to /profile', async () => {
    server.use(
      http.post('/api/v2/auth/bind/email/confirm', () =>
        HttpResponse.json({
          ok: true,
          user: { email: 'alice@example.com', emailVerified: true },
        }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<BindEmail />, {
      initialEntries: ['/bind-email?token=confirm-token-123'],
    });

    await user.type(screen.getByTestId('bind-email-password'), 'secret-pw-1');
    await user.click(screen.getByTestId('bind-email-confirm-submit'));

    expect(await screen.findByText(AUTH_COPY.bindEmail.successTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe('alice@example.com');
    });

    await waitFor(
      () => {
        expect(navigateSpy).toHaveBeenCalledWith('/profile', { replace: true });
      },
      { timeout: 2500 },
    );
  });
});
