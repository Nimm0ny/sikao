import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import RegisterEmail from '../auth/RegisterEmail';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

describe('RegisterEmail', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useAuthStore.setState({ user: null });
    localStorage.clear();
  });

  it('happy path: register success → setSession + navigate /app', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterEmail />, { initialEntries: ['/register/email'] });

    await user.type(screen.getByTestId('register-email-email'), 'newuser@example.com');
    await user.type(screen.getByTestId('register-email-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-email-submit'));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.email).toBe('newuser@example.com');
    });
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true });
    expect(screen.queryByTestId('register-email-form-error')).not.toBeInTheDocument();
  });

  it('409 email_taken: form-error strip shows registerEmailTaken copy', async () => {
    server.use(
      http.post('/api/v2/auth/register/email', () =>
        HttpResponse.json({ detail: 'email_taken' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RegisterEmail />, { initialEntries: ['/register/email'] });

    await user.type(screen.getByTestId('register-email-email'), 'taken@example.com');
    await user.type(screen.getByTestId('register-email-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-email-submit'));

    const errStrip = await screen.findByTestId('register-email-form-error');
    expect(errStrip).toHaveTextContent('该邮箱已被使用');
    expect(errStrip).toHaveAttribute('role', 'alert');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('client-side weak password: blocks submit before hitting API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterEmail />, { initialEntries: ['/register/email'] });

    await user.type(screen.getByTestId('register-email-email'), 'newuser@example.com');
    await user.type(screen.getByTestId('register-email-password'), 'abc'); // < 6 chars
    await user.click(screen.getByTestId('register-email-submit'));

    // client-side guard fires toast.warn (no form-error strip), no API call
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useAuthStore.getState().user).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('register-email-form-error')).not.toBeInTheDocument();
  });

  it('client-side missing @ in email: blocks submit before hitting API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterEmail />, { initialEntries: ['/register/email'] });

    await user.type(screen.getByTestId('register-email-email'), 'not-an-email');
    await user.type(screen.getByTestId('register-email-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-email-submit'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useAuthStore.getState().user).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
