import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import RegisterPhone from '../auth/RegisterPhone';

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

describe('RegisterPhone', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    useAuthStore.setState({ user: null });
    localStorage.clear();
  });

  it('happy path: register success → setSession + navigate /app', async () => {
    renderWithProviders(<RegisterPhone />, { initialEntries: ['/register/phone'] });

    fireEvent.change(screen.getByTestId('register-phone-phone'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByTestId('register-phone-code'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByTestId('register-phone-password'), {
      target: { value: 'strong-pw-1' },
    });
    fireEvent.click(screen.getByTestId('register-phone-submit'));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.phone).toBe('13800138000');
    });
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true });
    expect(screen.queryByTestId('register-phone-form-error')).not.toBeInTheDocument();
  });

  it('409 phone_taken: form-error strip shows registerPhoneTaken copy', async () => {
    server.use(
      http.post('/api/v2/auth/register/phone', () =>
        HttpResponse.json({ detail: 'phone_taken' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RegisterPhone />, { initialEntries: ['/register/phone'] });

    await user.type(screen.getByTestId('register-phone-phone'), '13800138000');
    await user.type(screen.getByTestId('register-phone-code'), '123456');
    await user.type(screen.getByTestId('register-phone-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-phone-submit'));

    const errStrip = await screen.findByTestId('register-phone-form-error');
    expect(errStrip).toHaveTextContent('该手机号已被使用');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('410 code_invalid: form-error strip shows registerCodeInvalid copy', async () => {
    server.use(
      http.post('/api/v2/auth/register/phone', () =>
        HttpResponse.json({ detail: 'code_invalid' }, { status: 410 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<RegisterPhone />, { initialEntries: ['/register/phone'] });

    await user.type(screen.getByTestId('register-phone-phone'), '13800138000');
    await user.type(screen.getByTestId('register-phone-code'), '999999');
    await user.type(screen.getByTestId('register-phone-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-phone-submit'));

    const errStrip = await screen.findByTestId('register-phone-form-error');
    expect(errStrip).toHaveTextContent('验证码错误或已过期');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('client-side: phone < 11 digits blocks submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPhone />, { initialEntries: ['/register/phone'] });

    await user.type(screen.getByTestId('register-phone-phone'), '12345');
    await user.type(screen.getByTestId('register-phone-code'), '123456');
    await user.type(screen.getByTestId('register-phone-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-phone-submit'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useAuthStore.getState().user).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('client-side: smsCode not 6 digits blocks submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPhone />, { initialEntries: ['/register/phone'] });

    await user.type(screen.getByTestId('register-phone-phone'), '13800138000');
    await user.type(screen.getByTestId('register-phone-code'), '12'); // < 6
    await user.type(screen.getByTestId('register-phone-password'), 'strong-pw-1');
    await user.click(screen.getByTestId('register-phone-submit'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useAuthStore.getState().user).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
