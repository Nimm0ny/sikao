import { describe, expect, it } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { OnboardingGate } from './OnboardingGate';

function renderGate(initialEntries: readonly string[] = ['/dashboard']) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/dashboard"
        element={
          <OnboardingGate>
            <div data-testid="protected-page">protected</div>
          </OnboardingGate>
        }
      />
      <Route
        path="/study/onboarding"
        element={<div data-testid="onboarding-page">onboarding</div>}
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

  it('redirects to /study/onboarding when the user is not onboarded', async () => {
    server.use(
      http.get('/api/v2/me/onboarding-status', () =>
        HttpResponse.json({
          hasGoal: true,
          hasExam: false,
          isOnboarded: false,
        }),
      ),
    );

    renderGate();

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-page')).toBeInTheDocument();
    });
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
        <Route path="/dashboard" element={<div data-testid="dashboard-page">dashboard</div>} />
      </Routes>,
      { initialEntries: ['/study/onboarding'] },
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });
});
