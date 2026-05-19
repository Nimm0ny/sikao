import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { RedirectGuard } from './RedirectGuard';

function LoginTarget() {
  const location = useLocation();
  const state = location.state as { readonly from?: string } | null;

  return <div data-testid="redirect-guard-login" data-from={state?.from ?? ''}>login</div>;
}

describe('RedirectGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, sessionExpiresAt: null });
    localStorage.clear();
  });

  it('preserves pathname and query when redirecting unauthenticated users to /login', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/profile"
          element={
            <RedirectGuard mode="require-auth">
              <div data-testid="redirect-guard-protected">protected</div>
            </RedirectGuard>
          }
        />
        <Route path="/login" element={<LoginTarget />} />
      </Routes>,
      { initialEntries: ['/profile?tab=security'] },
    );

    expect(await screen.findByTestId('redirect-guard-login')).toHaveAttribute(
      'data-from',
      '/profile?tab=security',
    );
    expect(screen.queryByTestId('redirect-guard-protected')).not.toBeInTheDocument();
  });
});
