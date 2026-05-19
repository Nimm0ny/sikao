import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { PRACTICE_CENTER_COPY } from '@/lib/ui-copy';
import PracticeCenter from '../PracticeCenter';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('PracticeCenter', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('renders one primary next action and subject state with default data', async () => {
    server.use(
      http.get('/api/v2/practice/last-session', () =>
        HttpResponse.json({
          id: 88,
          paperId: 8,
          paperTitle: '2026 行测短练',
          currentQuestionId: 3,
          answeredCount: 2,
          total: 10,
          startedAt: '2026-05-19T00:00:00Z',
        }),
      ),
    );

    const { container } = renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('practice-center-hero-primary')).toHaveTextContent(
        PRACTICE_CENTER_COPY.hero.primary.continue,
      );
    });
    expect(screen.getByTestId('practice-center-subject-state')).toHaveTextContent(
      PRACTICE_CENTER_COPY.subjects.xingce.stateTitle,
    );
    expect(container.querySelectorAll('[data-practice-role="primary-next-action"]')).toHaveLength(1);
  });

  it('switches hero copy for essay subject', async () => {
    renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center?subject=essay'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('practice-center-hero-primary')).toHaveTextContent(
        PRACTICE_CENTER_COPY.hero.primary.essay,
      );
    });
    expect(screen.getByTestId('practice-center-hero')).toHaveTextContent(
      PRACTICE_CENTER_COPY.hero.essayTitle,
    );
    expect(screen.getByTestId('practice-focus-card')).toHaveTextContent(
      PRACTICE_CENTER_COPY.subjects.essay.focusEmpty,
    );
  });

  it('renders auth fallback and preserves from-state when practice center queries return 401', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/v2/practice/last-session', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/practice/wrong-questions/weakness', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
    );

    renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center?subject=essay'],
    });

    expect(await screen.findByTestId('practice-center-auth-fallback')).toHaveTextContent(
      PRACTICE_CENTER_COPY.auth.title,
    );
    await user.click(screen.getByTestId('practice-center-auth-login'));

    expect(navigateMock).toHaveBeenCalledWith('/login', {
      state: { from: '/practice/center?subject=essay' },
    });
  });

  it('updates filter summary and hero action when mode filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center'],
    });

    await screen.findByTestId('practice-center-hero');
    await user.click(screen.getByTestId('practice-filter-toggle'));
    await user.selectOptions(
      screen.getByRole('combobox', { name: PRACTICE_CENTER_COPY.filters.mode.label }),
      'papers',
    );
    await user.click(screen.getByRole('button', { name: PRACTICE_CENTER_COPY.filterApply }));

    expect(screen.getByTestId('practice-filter-toggle')).toHaveTextContent('1');
    expect(screen.getByTestId('practice-filter-summary')).toHaveTextContent(
      PRACTICE_CENTER_COPY.filters.mode.options.papers,
    );
    expect(screen.getByTestId('practice-center-hero-primary')).toHaveTextContent(
      PRACTICE_CENTER_COPY.hero.primary.papers,
    );
  });

  it('renders hero error instead of empty recommendation when key queries fail', async () => {
    server.use(
      http.get('/api/v2/practice/last-session', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/practice/wrong-questions/weakness', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center'],
    });

    expect(await screen.findByTestId('practice-center-hero-error')).toHaveTextContent(
      PRACTICE_CENTER_COPY.hero.error,
    );
    expect(screen.getByTestId('practice-center-hero-retry')).toBeInTheDocument();
  });

  it('renders empty recent and focus states when practice data is empty', async () => {
    server.use(
      http.get('/api/v2/practice/last-session', () => HttpResponse.json(null)),
      http.get('/api/v2/practice/wrong-questions/weakness', () =>
        HttpResponse.json({ generatedAt: '2026-05-19T00:00:00Z', modules: [] }),
      ),
    );

    renderWithProviders(<PracticeCenter />, {
      initialEntries: ['/practice/center'],
    });

    expect(await screen.findByTestId('practice-recent-empty')).toHaveTextContent(
      PRACTICE_CENTER_COPY.recent.empty,
    );
    expect(screen.getByTestId('practice-focus-empty')).toHaveTextContent(
      PRACTICE_CENTER_COPY.subjects.xingce.focusEmpty,
    );
    expect(screen.getByTestId('practice-center-hero-primary')).toHaveTextContent(
      PRACTICE_CENTER_COPY.hero.primary.start,
    );
  });
});
