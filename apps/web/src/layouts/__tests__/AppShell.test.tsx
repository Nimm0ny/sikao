import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { AppShell } from '../AppShell';

function renderShell(initialEntries: readonly string[] = ['/']) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<div data-testid="page-home">home</div>} />
        <Route path="/practice" element={<div data-testid="page-practice">practice</div>} />
        <Route path="/review" element={<div data-testid="page-review">review</div>} />
        <Route path="/notes" element={<div data-testid="page-notes">notes</div>} />
        <Route path="/profile" element={<div data-testid="page-profile">profile</div>} />
      </Route>
    </Routes>,
    { initialEntries },
  );
}

describe('AppShell MVP layout', () => {
  it('renders the MVP shell without the legacy fixed sidebar', async () => {
    renderShell();

    expect(await screen.findByTestId('mvp-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mvp-brand')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('page-home')).toBeInTheDocument();
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
  });

  it('renders primary MVP navigation links', async () => {
    renderShell(['/practice']);

    expect(await screen.findByTestId('mvp-nav-home')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('mvp-nav-practice')).toHaveAttribute('href', '/practice');
    expect(screen.getByTestId('mvp-nav-review')).toHaveAttribute('href', '/review');
    expect(screen.getByTestId('mvp-nav-notes')).toHaveAttribute('href', '/notes');
    expect(screen.getByTestId('mvp-nav-profile')).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('link', { name: '考试日历' })).not.toBeInTheDocument();
    expect(screen.getByTestId('page-practice')).toBeInTheDocument();
  });
});
