import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { AppShell } from '../AppShell';

function renderShell(initialEntries: readonly string[] = ['/dashboard']) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<div data-testid="page-dashboard">dashboard</div>} />
        <Route path="/practice/center" element={<div data-testid="page-practice">practice</div>} />
        <Route path="/wrong-book" element={<div data-testid="page-wrong-book">wrong</div>} />
        <Route path="/notes" element={<div data-testid="page-notes">notes</div>} />
        <Route path="/plan" element={<div data-testid="page-plan">plan</div>} />
      </Route>
    </Routes>,
    { initialEntries },
  );
}

describe('AppShell MVP layout', () => {
  it('renders the MVP shell without the legacy fixed sidebar', async () => {
    renderShell();

    expect(await screen.findByTestId('mvp-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mvp-brand')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
  });

  it('renders primary MVP navigation links', async () => {
    renderShell(['/practice/center']);

    expect(await screen.findByTestId('mvp-nav-dashboard')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('mvp-nav-practice')).toHaveAttribute('href', '/practice/center');
    expect(screen.getByTestId('mvp-nav-wrong-book')).toHaveAttribute('href', '/wrong-book');
    expect(screen.getByTestId('mvp-nav-notes')).toHaveAttribute('href', '/notes');
    expect(screen.getByTestId('mvp-nav-plan')).toHaveAttribute('href', '/plan');
    expect(screen.getByTestId('page-practice')).toBeInTheDocument();
  });
});
