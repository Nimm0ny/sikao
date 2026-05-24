/*
 * AuthGuard tests — SIK-89 Home M-Auth (2026-05-24).
 *
 * Cover the three branches:
 *   1. user == null → BootCard
 *   2. user.onboardingCompleted === false → BootCard
 *   3. user logged in & onboardingCompleted true (or undefined) → Outlet
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useAuthStore } from '@sikao/domain';
import type { AuthUserSummary } from '@sikao/domain/auth/useAuthStore';
import { AuthGuard } from './AuthGuard';

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AuthGuard />,
        children: [{ index: true, element: <div data-testid="protected">protected</div> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AuthGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, sessionExpiresAt: null });
  });

  it('renders BootCard when user is null', () => {
    renderWithRouter();
    expect(screen.getByTestId('boot-card')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('renders BootCard when onboardingCompleted is false', () => {
    const user: AuthUserSummary = {
      id: 1,
      displayName: 'Test',
      onboardingCompleted: false,
    };
    useAuthStore.setState({ user, sessionExpiresAt: null });
    renderWithRouter();
    expect(screen.getByTestId('boot-card')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('renders Outlet when user is logged in with onboardingCompleted true', () => {
    const user: AuthUserSummary = {
      id: 1,
      displayName: 'Test',
      onboardingCompleted: true,
    };
    useAuthStore.setState({ user, sessionExpiresAt: null });
    renderWithRouter();
    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.queryByTestId('boot-card')).not.toBeInTheDocument();
  });

  it('renders Outlet when onboardingCompleted is undefined (legacy users)', () => {
    const user: AuthUserSummary = {
      id: 2,
      displayName: 'Legacy',
    };
    useAuthStore.setState({ user, sessionExpiresAt: null });
    renderWithRouter();
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });
});
