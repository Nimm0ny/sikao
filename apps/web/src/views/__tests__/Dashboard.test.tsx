import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import Dashboard from '../Dashboard';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('Dashboard MVP', () => {
  it('renders the main task card and surrounding dashboard cards', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-main-task')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-exam-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-weak-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-plan-mini')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-recent-session')).toBeInTheDocument();

    expect(await screen.findByTestId('dashboard-main-start')).toHaveTextContent('继续主任务');
  });

  it('renders today plan tasks from the existing study-plan API', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    const planMini = screen.getByTestId('dashboard-plan-mini');
    expect((await within(planMini).findAllByText(/待完成/)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('dashboard-progress-card')).toHaveTextContent('总任务');
  });

  it('renders result-oriented action cards for the closed loop', () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(screen.getByTestId('dashboard-action-wrong-book')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-action-notes')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-action-plan')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-action-essay')).toBeInTheDocument();
  });
});
