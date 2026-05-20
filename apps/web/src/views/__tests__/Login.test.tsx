import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { ERROR_COPY } from '@/lib/ui-copy';
import Login from '../auth/Login';

// useNavigate spy — patch react-router-dom 的 useNavigate, 让测试可断 navigate
// 调用. MemoryRouter 不暴露 location.pathname 给外部, 所以用 spy 比较直接.
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

describe('Login', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    // zustand persist localStorage 残留会跨 test 污染 isAuthenticated.
    useAuthStore.setState({ user: null });
    localStorage.clear();
  });

  it('happy path: setSession is called and navigate("/app") fires', async () => {
    renderWithProviders(<Login />, { initialEntries: ['/login'] });

    fireEvent.change(screen.getByTestId('login-identifier'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'secret-pw-1' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.username).toBe('alice');
    });
    expect(navigateSpy).toHaveBeenCalledWith('/app', { replace: true });
    // form-error strip should remain hidden on success
    expect(screen.queryByTestId('login-form-error')).not.toBeInTheDocument();
  });

  it('preserves the attempted path query when login receives a protected-route return target', async () => {
    renderWithProviders(<Login />, {
      initialEntries: [{ pathname: '/login', state: { from: '/dashboard?source=notes' } }],
    });

    fireEvent.change(screen.getByTestId('login-identifier'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'secret-pw-1' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.username).toBe('alice');
    });
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard?source=notes', { replace: true });
  });

  it('401 invalid credentials: form-error strip persists with credential copy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />, { initialEntries: ['/login'] });

    await user.type(screen.getByTestId('login-identifier'), 'baduser');
    await user.type(screen.getByTestId('login-password'), 'wrong-pw-1');
    await user.click(screen.getByTestId('login-submit'));

    const errStrip = await screen.findByTestId('login-form-error');
    expect(errStrip).toHaveTextContent(ERROR_COPY.loginCredential.title);
    expect(errStrip).toHaveAttribute('role', 'alert');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('network error: form-error strip persists with network copy', async () => {
    server.use(
      http.post('/api/v2/auth/login', () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    renderWithProviders(<Login />, { initialEntries: ['/login'] });

    await user.type(screen.getByTestId('login-identifier'), 'alice');
    await user.type(screen.getByTestId('login-password'), 'secret-pw-1');
    await user.click(screen.getByTestId('login-submit'));

    const errStrip = await screen.findByTestId('login-form-error');
    expect(errStrip).toHaveTextContent(ERROR_COPY.loginNetwork.title);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
