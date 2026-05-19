import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { AUTH_COPY, ERROR_COPY } from '@/lib/ui-copy';
import BindPhone from '../auth/BindPhone';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

describe('BindPhone', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useAuthStore.setState({
      user: { id: 1, username: 'alice', displayName: 'Alice', phone: null, email: null },
      sessionExpiresAt: null,
    });
    localStorage.clear();
  });

  it('happy path: updates session phone and redirects to /profile', async () => {
    server.use(
      http.post('/api/v2/auth/bind/phone/confirm', () =>
        HttpResponse.json({
          ok: true,
          user: { phone: '13800138000', phoneVerified: true },
        }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<BindPhone />, { initialEntries: ['/bind-phone'] });

    await user.type(screen.getByTestId('bind-phone-phone'), '13800138000');
    await user.type(screen.getByTestId('bind-phone-code'), '123456');
    await user.type(screen.getByTestId('bind-phone-password'), 'secret-pw-1');
    await user.click(screen.getByTestId('bind-phone-submit'));

    expect(await screen.findByText(AUTH_COPY.bindPhone.successTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().user?.phone).toBe('13800138000');
    });

    await waitFor(
      () => {
        expect(navigateSpy).toHaveBeenCalledWith('/profile', { replace: true });
      },
      { timeout: 2500 },
    );
  });

  it('410 code_invalid: keeps user on form and renders error strip', async () => {
    server.use(
      http.post('/api/v2/auth/bind/phone/confirm', () =>
        HttpResponse.json({ detail: 'code_invalid' }, { status: 410 }),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<BindPhone />, { initialEntries: ['/bind-phone'] });

    await user.type(screen.getByTestId('bind-phone-phone'), '13800138000');
    await user.type(screen.getByTestId('bind-phone-code'), '999999');
    await user.type(screen.getByTestId('bind-phone-password'), 'secret-pw-1');
    await user.click(screen.getByTestId('bind-phone-submit'));

    const errorStrip = await screen.findByTestId('bind-phone-form-error');
    expect(errorStrip).toHaveTextContent(ERROR_COPY.bindCodeInvalid.title);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
