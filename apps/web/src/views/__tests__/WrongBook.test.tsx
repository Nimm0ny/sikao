import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import WrongBook from '../WrongBook';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('WrongBook', () => {
  it('happy path → PageHeader renders 错题本 + total subtitle', async () => {
    // 默认 msw handler 返 200 with empty items + total=0
    let papersCallCount = 0;
    server.use(
      http.get('/api/v2/papers', () => {
        papersCallCount += 1;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-view')).toBeInTheDocument();
    });
    // SIKAO Wave 4 Phase 2D: WrongBookHero renders h1 with "错题本" + subtitle.
    // Use regex to match the leading "错题本" prefix since hero h1 contains
    // additional editorial subtitle inside same heading element.
    expect(
      screen.getByRole('heading', { level: 1, name: /错题本/ }),
    ).toBeInTheDocument();
    expect(papersCallCount).toBe(0);
  });

  it('isError → tone="error" EmptyState with wrongbook-retry button', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions', () =>
        HttpResponse.json({ detail: 'server_error' }, { status: 500 }),
      ),
    );

    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(screen.getByTestId('wrongbook-retry')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('错题加载失败');
  });

  it('点 wrongbook-retry → 二次 fetch 成功 → 渲 PageHeader + wrong-book-view', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/practice/wrong-questions', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'server_error' }, { status: 500 });
        }
        return HttpResponse.json({
          items: [],
          total: 0,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(screen.getByTestId('wrongbook-retry')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('wrongbook-retry'));
    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-view')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });

  // 规范官 P0-1 (2026-05-08): paperCode 切到 server-side filter, mock handler
  // 必须按 paperCode query 返回 filtered 数据 (跟后端实际行为对齐). 旧 client-
  // side filter 已删 — 跨页错题不再 silently 丢失.
  it('?paperCode=GW-2025-001 → chip 渲, 列表只显该卷错题 (server-side filter)', async () => {
    let lastPaperCodeQuery: string | null = null;
    server.use(
      http.get('/api/v2/practice/wrong-questions', ({ request }) => {
        const url = new URL(request.url);
        lastPaperCodeQuery = url.searchParams.get('paperCode');
        // mock server-side filter: paperCode 命中只返该卷题.
        const allItems = [
          makeWrongItem({ questionId: 1, paperCode: 'GW-2025-001', stem: '题 A 来自 GW-2025-001' }),
          makeWrongItem({ questionId: 2, paperCode: 'SJ-2024-009', stem: '题 B 来自其他卷' }),
          makeWrongItem({ questionId: 3, paperCode: 'GW-2025-001', stem: '题 C 来自 GW-2025-001' }),
        ];
        const filtered = lastPaperCodeQuery !== null
          ? allItems.filter((it) => it.paperCode === lastPaperCodeQuery)
          : allItems;
        return HttpResponse.json({
          items: filtered,
          total: filtered.length,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        });
      }),
    );
    renderWithProviders(<WrongBook />, {
      initialEntries: ['/wrong-book?paperCode=GW-2025-001'],
    });
    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-paper-filter')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wrong-book-paper-filter-clear')).toHaveTextContent('GW-2025-001');
    // server 收到 paperCode query.
    expect(lastPaperCodeQuery).toBe('GW-2025-001');
    // 只有 GW-2025-001 两题渲, 其他卷的题不渲.
    await waitFor(() => {
      expect(screen.getByTestId('wrong-card-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wrong-card-3')).toBeInTheDocument();
    expect(screen.queryByTestId('wrong-card-2')).toBeNull();
  });

  it('点 paperCode chip ×  → filter 清除 → 全部题恢复', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions', ({ request }) => {
        const url = new URL(request.url);
        const paperCode = url.searchParams.get('paperCode');
        const allItems = [
          makeWrongItem({ questionId: 1, paperCode: 'GW-2025-001', stem: '题 A' }),
          makeWrongItem({ questionId: 2, paperCode: 'SJ-2024-009', stem: '题 B' }),
        ];
        const filtered = paperCode !== null
          ? allItems.filter((it) => it.paperCode === paperCode)
          : allItems;
        return HttpResponse.json({
          items: filtered,
          total: filtered.length,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WrongBook />, {
      initialEntries: ['/wrong-book?paperCode=GW-2025-001'],
    });
    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-paper-filter-clear')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('wrong-book-paper-filter-clear'));
    await waitFor(() => {
      expect(screen.queryByTestId('wrong-book-paper-filter')).toBeNull();
    });
    expect(screen.getByTestId('wrong-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-card-2')).toBeInTheDocument();
  });
});

// helper — 给 WrongBook 测试快速构造 WrongQuestionDetailV2.
interface WrongItemPartial {
  readonly questionId: number;
  readonly paperCode: string | null;
  readonly stem: string;
}

function makeWrongItem(p: WrongItemPartial) {
  return {
    questionId: p.questionId,
    stem: p.stem,
    options: [
      { key: 'A', text: 'A', isCorrect: false },
      { key: 'B', text: 'B', isCorrect: true },
    ],
    correctAnswerKeys: ['B'],
    userLatestAnswerKeys: ['A'],
    explanation: '解析',
    subject: '资料分析',
    subtype: null,
    questionKind: 'single_choice',
    paperCode: p.paperCode,
    paperName: p.paperCode ?? null,
    wrongCount: 1,
    masteryLevel: 'reviewing' as const,
    lastWrongTime: '2026-05-01T10:00:00',
    consecutiveCorrectCount: 0,
  };
}
