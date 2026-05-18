import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import PracticeStart from '../PracticeStart';
import { logger, toast } from '@sikao/shared-utils';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ paperCode: 'D1' }),
  };
});

const PAPER_SUMMARY = {
  paperCode: 'D1',
  revisionId: 1,
  paperName: 'D1 套卷',
  questionCount: 30,
  status: 'published',
};

beforeEach(() => {
  navigateMock.mockReset();
});

describe('PracticeStart', () => {
  it('renders compact loading state', () => {
    server.use(
      http.get('/api/v2/papers/D1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return HttpResponse.json(PAPER_SUMMARY);
      }),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/D1/start'],
    });
    expect(screen.getByTestId('practice-start-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('start-exam-btn')).not.toBeInTheDocument();
  });

  it('renders load error with retry action', async () => {
    server.use(
      http.get('/api/v2/papers/D1', () =>
        HttpResponse.json({ detail: 'err' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/D1/start'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-retry')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
  });

  it('retry recovers to the one-page ready view', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/papers/D1', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'transient' }, { status: 503 });
        }
        return HttpResponse.json(PAPER_SUMMARY);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/D1/start'],
    });

    const retry = await screen.findByTestId('start-retry');
    await user.click(retry);
    await waitFor(() => {
      expect(screen.getByTestId('practice-start-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('start-exam-btn')).toBeInTheDocument();
    expect(callCount).toBe(2);
  });

  it('ready state keeps paper metadata and start CTA', async () => {
    server.use(
      http.get('/api/v2/papers/D1', () => HttpResponse.json(PAPER_SUMMARY)),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/D1/start'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('practice-start-view')).toBeInTheDocument();
    });
    expect(screen.getByText('D1 套卷')).toBeInTheDocument();
    expect(screen.getAllByText('30')).toHaveLength(2);
    expect(screen.getByTestId('start-exam-btn')).toHaveTextContent('开始答题');
  });

  it('start session failure logs, toasts, and does not navigate', async () => {
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => 0);
    const swallowed: unknown[] = [];
    const handler = (reason: unknown) => {
      swallowed.push(reason);
    };
    globalThis.process.on('unhandledRejection', handler);

    server.use(
      http.get('/api/v2/papers/D1', () => HttpResponse.json(PAPER_SUMMARY)),
      http.post('/api/v2/practice/papers/D1/start', () =>
        HttpResponse.json({ detail: 'server err' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/D1/start'],
    });

    const startButton = await screen.findByTestId('start-exam-btn');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'practice.start.failed',
        expect.any(Object),
      );
    });
    expect(toastErrorSpy).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(swallowed.length).toBeGreaterThan(0);

    globalThis.process.off('unhandledRejection', handler);
    loggerErrorSpy.mockRestore();
    toastErrorSpy.mockRestore();
  });
});
