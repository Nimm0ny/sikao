import { describe, expect, it } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { OnboardingGate } from './OnboardingGate';
import { ROUTE_MAP } from './RouteMap';

function OnboardingTarget() {
  const location = useLocation();
  const state = location.state as { readonly from?: string } | null;
  return <div data-testid="onboarding-page" data-from={state?.from ?? ''}>onboarding</div>;
}

function renderGate(initialEntries: readonly string[] = [ROUTE_MAP.dashboard]) {
  return renderWithProviders(
    <Routes>
      <Route
        path={ROUTE_MAP.dashboard}
        element={
          <OnboardingGate>
            <div data-testid="protected-page">protected</div>
          </OnboardingGate>
        }
      />
      <Route
        path={ROUTE_MAP.studyOnboarding}
        element={<OnboardingTarget />}
      />
    </Routes>,
    { initialEntries },
  );
}

describe('OnboardingGate', () => {
  it('renders children when the user is already onboarded', async () => {
    renderGate();
    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('redirects to /study/onboarding and preserves the attempted path when the user is not onboarded', async () => {
    server.use(
      http.get('/api/v2/me/onboarding-status', () =>
        HttpResponse.json({
          hasGoal: true,
          hasExam: false,
          isOnboarded: false,
        }),
      ),
    );

    renderGate(['/dashboard?source=notes']);

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('onboarding-page')).toHaveAttribute('data-from', '/dashboard?source=notes');
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('shows a loading gate before onboarding status resolves for protected routes', async () => {
    server.use(
      http.get('/api/v2/me/onboarding-status', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({
          hasGoal: true,
          hasExam: true,
          isOnboarded: true,
        });
      }),
    );

    renderGate();
    expect(screen.getByTestId('onboarding-gate-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('protected-page')).toBeInTheDocument();
    });
  });

  it('allows the onboarding route itself and redirects onboarded users away from it', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/study/onboarding"
          element={
            <OnboardingGate>
              <div data-testid="onboarding-page">onboarding</div>
            </OnboardingGate>
          }
        />
        <Route path={ROUTE_MAP.dashboard} element={<div data-testid="dashboard-page">dashboard</div>} />
      </Routes>,
      { initialEntries: [ROUTE_MAP.studyOnboarding] },
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });
});
