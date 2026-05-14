import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import NotFound from '../NotFound';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

describe('NotFound', () => {
  it('renders EmptyState with title + back-home CTA', () => {
    navigate.mockClear();
    renderWithProviders(<NotFound />, { initialEntries: ['/missing'] });
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(screen.getByText('页面不见了')).toBeInTheDocument();
    expect(screen.getByTestId('not-found-back-home')).toBeInTheDocument();
  });

  it('back-home button navigates to /app', async () => {
    navigate.mockClear();
    const user = userEvent.setup();
    renderWithProviders(<NotFound />, { initialEntries: ['/missing'] });
    await user.click(screen.getByTestId('not-found-back-home'));
    expect(navigate).toHaveBeenCalledWith('/app');
  });
});
