import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { AUTH_COPY } from '@/lib/ui-copy';
import CompleteProfile from '../auth/CompleteProfile';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

describe('CompleteProfile', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'legacy_alice',
        displayName: 'Alice',
        email: null,
        phone: null,
        needsIdentifierSetup: true,
      },
      sessionExpiresAt: null,
    });
    localStorage.clear();
  });

  it('email tab: sends bind link and renders dev link state', async () => {
    server.use(
      http.post('/api/v2/auth/bind/email/send-link', () =>
        HttpResponse.json({ ok: true, _devMagicLink: 'complete-email-token-abc' }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<CompleteProfile />, {
      initialEntries: ['/complete-profile'],
    });

    await user.type(screen.getByTestId('complete-email-input'), 'alice@example.com');
    await user.click(screen.getByTestId('complete-email-submit'));

    expect(await screen.findByText(AUTH_COPY.bindEmail.sentTitle)).toBeInTheDocument();
    expect(screen.getByTestId('complete-email-dev-link')).toHaveTextContent(
      '/bind-email?token=complete-email-token-abc',
    );
  });

  it('phone tab: confirms phone, updates session, and redirects to /app', async () => {
    server.use(
      http.post('/api/v2/auth/bind/phone/confirm', () =>
        HttpResponse.json({
          ok: true,
          user: { phone: '13800138000', phoneVerified: true, needsIdentifierSetup: false },
        }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<CompleteProfile />, {
      initialEntries: ['/complete-profile'],
    });

    await user.click(screen.getByTestId('complete-tab-phone'));
    await user.type(screen.getByTestId('complete-phone-input'), '13800138000');
    await user.type(screen.getByTestId('complete-phone-code'), '123456');
    await user.type(screen.getByTestId('complete-phone-password'), 'secret-pw-1');
    await user.click(screen.getByTestId('complete-phone-submit'));

    expect(await screen.findByText(AUTH_COPY.bindPhone.successTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().user?.phone).toBe('13800138000');
      expect(useAuthStore.getState().user?.needsIdentifierSetup).toBe(false);
    });

    await waitFor(
      () => {
        expect(navigateSpy).toHaveBeenCalledWith('/app', { replace: true });
      },
      { timeout: 2500 },
    );
  });
});
