import { describe, expect, it } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { OnboardingGate } from './OnboardingGate';

function renderGate(initialEntries: readonly string[] = ['/study/today']) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/study/today"
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
});
