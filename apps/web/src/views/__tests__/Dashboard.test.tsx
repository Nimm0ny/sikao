import { describe, expect, it, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@/test-utils/server';
import { DASHBOARD_COPY } from '@/lib/ui-copy';
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
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('renders the main task card and surrounding dashboard cards', async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-main-task')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-exam-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-weak-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-plan-mini')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-recent-session')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dashboard-main-task')).queryByRole('img', { name: /学习进度/ }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('dashboard-progress-card')).getByRole('img', { name: /今日完成/ }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('dashboard-exam-card')).getByRole('button', { name: '考试日历' }),
    ).toBeInTheDocument();

    expect(await screen.findByTestId('dashboard-main-start')).toHaveTextContent('继续主任务');
  });

  it('opens the calendar from the countdown card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    await user.click(screen.getByTestId('dashboard-exam-calendar'));

    expect(navigateMock).toHaveBeenCalledWith('/calendar');
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

  it('shows the active loop stage and keeps one primary next action', async () => {
    const { container } = renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(await screen.findByTestId('dashboard-loop-stage')).toHaveTextContent(
      DASHBOARD_COPY.loop.currentLabel,
    );
    await screen.findByTestId('dashboard-main-start');
    expect(screen.getByTestId('dashboard-loop-stage-active')).toHaveTextContent(
      DASHBOARD_COPY.loop.stages.practice,
    );
    expect(container.querySelectorAll('[data-dashboard-role="primary-next-action"]')).toHaveLength(1);
  });

  it('renders loading state while the main plan query is pending', () => {
    server.use(
      http.get('/api/v2/study-plan/today', async () => {
        await delay(1_000);
        return HttpResponse.json(null);
      }),
    );

    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(screen.getByTestId('dashboard-main-task-loading')).toHaveTextContent(
      DASHBOARD_COPY.status.loading,
    );
  });

  it('renders actionable empty states instead of hiding empty CTAs', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () => HttpResponse.json(null)),
      http.get('/api/v2/practice/last-session', () => HttpResponse.json(null)),
      http.get('/api/v2/user-exams', () => HttpResponse.json({ exams: [], total: 0 })),
      http.get('/api/v2/practice/wrong-questions/weakness', () =>
        HttpResponse.json({ generatedAt: '2026-05-19T00:00:00Z', modules: [] }),
      ),
    );

    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(await screen.findByTestId('dashboard-main-task-empty')).toHaveTextContent(
      DASHBOARD_COPY.main.emptyTitle,
    );
    expect(screen.getByTestId('dashboard-main-empty-practice')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-recent-session-empty')).toHaveTextContent(
      DASHBOARD_COPY.recent.empty,
    );
  });

  it('renders retryable error state for failed dashboard data', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(await screen.findByTestId('dashboard-main-task-error')).toHaveTextContent(
      DASHBOARD_COPY.status.error,
    );
    expect(screen.getByTestId('dashboard-main-task-retry')).toBeInTheDocument();
  });

  it('renders ai hint error instead of fake empty copy when weakness query fails', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/weakness', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(await screen.findByTestId('dashboard-ai-hint-error')).toHaveTextContent(
      DASHBOARD_COPY.status.error,
    );
  });

  it('renders auth fallback when dashboard data returns 401', async () => {
    server.use(
      http.get('/api/v2/study-plan/today', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
    );

    renderWithProviders(<Dashboard />, { initialEntries: ['/dashboard'] });

    expect(await screen.findByTestId('dashboard-auth-fallback')).toHaveTextContent(
      DASHBOARD_COPY.auth.title,
    );
    expect(screen.getByTestId('dashboard-auth-login')).toBeInTheDocument();
  });
});
