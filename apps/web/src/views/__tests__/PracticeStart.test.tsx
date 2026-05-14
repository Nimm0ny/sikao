import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import PracticeStart from '../PracticeStart';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';

/**
 * P1-5 (full review 2026-04-30): PracticeStart 失败路径之前没 vitest. 含
 * try/catch + toast.error + throw 的 fail-fast 路径必须有失败路径单测.
 */

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
  paperName: 'D1 卷',
  questionCount: 30,
  status: 'published',
};

beforeEach(() => {
  navigateMock.mockReset();
});

describe('PracticeStart', () => {
  it('loading state renders skeleton', () => {
    server.use(
      http.get('/api/v2/papers/D1', async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return HttpResponse.json(PAPER_SUMMARY);
      }),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/papers/D1/start'],
    });
    // skeleton 渲染前不应该看到 "开始练习" CTA
    expect(screen.queryByText(/开始练习/)).not.toBeInTheDocument();
  });

  it('paper load error → tone="error" EmptyState + retry button', async () => {
    server.use(
      http.get('/api/v2/papers/D1', () =>
        HttpResponse.json({ detail: 'err' }, { status: 500 }),
      ),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/papers/D1/start'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('start-retry')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
  });

  it('点 start-retry → 二次 fetch 成功 → ready frame 渲 (StatCallout + 开始按钮)', async () => {
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
      initialEntries: ['/practice/papers/D1/start'],
    });

    const retry = await screen.findByTestId('start-retry');
    await user.click(retry);
    await waitFor(() => {
      expect(screen.getByText('总题数')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });

  it('paper not found (404) → not found EmptyState (无 retry, 仅返回)', async () => {
    server.use(
      http.get('/api/v2/papers/D1', () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/papers/D1/start'],
    });

    await waitFor(() => {
      // not found 走 isError=true → load error path (跟 500 共用 EmptyState)
      expect(screen.getByTestId('start-retry')).toBeInTheDocument();
    });
  });

  it('ready state: paper 元信息 + 开始按钮', async () => {
    server.use(
      http.get('/api/v2/papers/D1', () => HttpResponse.json(PAPER_SUMMARY)),
    );
    renderWithProviders(<PracticeStart />, {
      initialEntries: ['/practice/papers/D1/start'],
    });

    // ready frame 含 "总题数" StatCallout + "开始练习" CTA + "建议用时" text
    await waitFor(() => {
      expect(screen.getByText('总题数')).toBeInTheDocument();
    });
    expect(screen.getByText('建议用时')).toBeInTheDocument();
    // 开始 button 渲染 (用 role 而不是 text — text "D1" 在 breadcrumb / heading / MetaPair 三处出现)
    expect(screen.getByRole('button', { name: /开始/ })).toBeInTheDocument();
  });

  it('start session failure → logger.error + toast.error + 不 navigate', async () => {
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const toastErrorSpy = vi.spyOn(toast, 'error').mockImplementation(() => 0);
    // handleStart `throw err` 是 fail-fast (frontend §3.1) — production 由
    // React Query onError / ErrorBoundary 接住, 测试不 mount 那些, throw 会变成
    // node 的 unhandledRejection. 局部 swallow 不让 vitest 标 file fail.
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
      initialEntries: ['/practice/papers/D1/start'],
    });

    const startButton = await screen.findByRole('button', {
      name: /开始/,
    });
    fireEvent.click(startButton);

    // start 失败 → logger.error + toast.error 被调, navigate 不调, 且 throw 一个
    await waitFor(() => {
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'practice.start.failed',
        expect.any(Object),
      );
    });
    expect(toastErrorSpy).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();

    // 等下 tick 让 unhandledRejection fire (确保我们捕到, vitest 才不标 fail)
    await new Promise((r) => setTimeout(r, 50));
    expect(swallowed.length).toBeGreaterThan(0);

    globalThis.process.off('unhandledRejection', handler);
    loggerErrorSpy.mockRestore();
    toastErrorSpy.mockRestore();
  });
});
