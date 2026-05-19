import type { ReactElement } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { WrongQuestionList } from '@/components/wrong-book';
import WrongBook from '../WrongBook';
import SmartReviewView from '../SmartReviewView';
import WrongQuestionRedoView from '../WrongQuestionRedoView';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/notes', () => ({
  NoteCaptureLauncher: ({ testId }: { readonly testId?: string }) => (
    <div data-testid={testId ?? 'mock-note-capture'} />
  ),
  CommunityNotesSection: ({
    questionId,
  }: {
    readonly questionId: number;
  }) => <div data-testid={`mock-community-notes-${questionId}`} />,
}));

beforeEach(() => {
  mockNavigate.mockReset();
});

const SMART_REVIEW_TODAY = {
  pushedToday: 6,
  finishedToday: 2,
  streakDays: 4,
  daysToExam: 19,
};

const SMART_REVIEW_NEXT = {
  questionId: 42,
  stem: '<p>这是一道需要继续复盘的题</p>',
  knowledgePoint: '资料分析',
  consecutiveCorrectCount: 1,
  mode: 'qifei' as const,
};

describe('WrongQuestionList', () => {
  it('total>0 且 items=[] 时不渲染“没有错题”空态', () => {
    renderWithProviders(
      <WrongQuestionList
        items={[]}
        selectedId={null}
        onSelect={() => undefined}
        total={2}
        page={1}
        pageSize={20}
        onPageChange={() => undefined}
      />,
    );

    const list = screen.getByTestId('wrong-question-list');
    expect(list).toBeInTheDocument();
    expect(list).toHaveTextContent('共 2 题');
    expect(screen.queryByText('没有错题')).toBeNull();
  });
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
  it('?view=ok → request 带 mastery_level=mastered，列表只显示已毕业错题', async () => {
    let lastMasteryLevelQuery: string | null = null;
    server.use(
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 1,
          todoCount: 0,
          dangerCount: 0,
          graduatedCount: 1,
          weeklyNew: 0,
        }),
      ),
      http.get('/api/v2/practice/wrong-questions', ({ request }) => {
        const url = new URL(request.url);
        lastMasteryLevelQuery = url.searchParams.get('mastery_level');
        const allItems = [
          makeWrongItem({
            questionId: 1,
            paperCode: 'GW-2025-001',
            stem: '题 A 已毕业',
            masteryLevel: 'mastered',
          }),
          makeWrongItem({
            questionId: 2,
            paperCode: 'GW-2025-001',
            stem: '题 B 未毕业',
            masteryLevel: 'reviewing',
          }),
        ];
        const filtered =
          lastMasteryLevelQuery === 'mastered'
            ? allItems.filter((it) => it.masteryLevel === 'mastered')
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
      initialEntries: ['/wrong-book?view=ok'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-view')).toBeInTheDocument();
    });

    expect(lastMasteryLevelQuery).toBe('mastered');
    expect(screen.getByTestId('wrong-card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('wrong-card-2')).toBeNull();
  });

  it('?paperCode=GW-2025-001 → chip 渲, 列表只显该卷错题 (server-side filter)', async () => {
    let lastPaperCodeQuery: string | null = null;
    server.use(
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 3,
          todoCount: 2,
          dangerCount: 0,
          graduatedCount: 0,
          weeklyNew: 1,
        }),
      ),
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
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 2,
          todoCount: 1,
          dangerCount: 0,
          graduatedCount: 0,
          weeklyNew: 1,
        }),
      ),
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

  it('list total>0 但 items=[] 时渲染 error state，而不是假空态', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 2,
          todoCount: 1,
          dangerCount: 0,
          graduatedCount: 0,
          weeklyNew: 1,
        }),
      ),
      http.get('/api/v2/practice/wrong-questions', () =>
        HttpResponse.json({
          items: [],
          total: 2,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(
        screen.getByTestId('wrong-book-inconsistent-state'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('错题加载失败');
    expect(screen.queryByText('没有错题')).toBeNull();
    expect(screen.queryByTestId('wrong-question-list')).toBeNull();
  });

  it('summary 全 0 但 list 非空时渲染 inconsistent state', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 0,
          todoCount: 0,
          dangerCount: 0,
          graduatedCount: 0,
          weeklyNew: 0,
        }),
      ),
      http.get('/api/v2/practice/wrong-questions', () =>
        HttpResponse.json({
          items: [
            makeWrongItem({
              questionId: 1,
              paperCode: 'GW-2025-001',
              stem: '题 A',
            }),
          ],
          total: 1,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(
        screen.getByTestId('wrong-book-inconsistent-state'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('错题加载失败');
    expect(screen.queryByTestId('wrong-book-hero')).toBeNull();
    expect(screen.queryByTestId('wrong-question-list')).toBeNull();
  });

  it('批量重做跨卷选择时禁用，并给出明确原因', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/summary', () =>
        HttpResponse.json({
          inPractice: 2,
          todoCount: 2,
          dangerCount: 0,
          graduatedCount: 0,
          weeklyNew: 1,
        }),
      ),
      http.get('/api/v2/practice/wrong-questions', () =>
        HttpResponse.json({
          items: [
            makeWrongItem({
              questionId: 1,
              paperCode: 'GW-2025-001',
              stem: '题 A',
            }),
            makeWrongItem({
              questionId: 2,
              paperCode: 'GW-2025-002',
              stem: '题 B',
            }),
          ],
          total: 2,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<WrongBook />, { initialEntries: ['/wrong-book'] });

    await waitFor(() => {
      expect(screen.getByTestId('wrong-card-1')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('checkbox', { name: '批量选中 第 1 题' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: '批量选中 第 2 题' }),
    );

    expect(screen.getByTestId('wrong-batch-retry')).toBeDisabled();
    expect(screen.getByTestId('wrong-batch-retry-hint')).toHaveTextContent(
      '批量重做只能选择同一套卷的错题',
    );
  });
});

describe('SmartReviewView', () => {
  it('提供返回错题本入口，并保留危险模式跳转', async () => {
    server.use(
      http.get('/api/v2/practice/smart-review/today', () =>
        HttpResponse.json(SMART_REVIEW_TODAY),
      ),
      http.get('/api/v2/practice/smart-review/next', () =>
        HttpResponse.json(SMART_REVIEW_NEXT),
      ),
    );

    const user = userEvent.setup();
    renderRoute(
      '/wrong-book/smart-review',
      '/wrong-book/smart-review',
      <SmartReviewView />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('smart-review-view')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('smart-review-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/wrong-book');

    mockNavigate.mockReset();
    await user.click(screen.getByTestId('smart-review-mode-danger'));
    expect(mockNavigate).toHaveBeenCalledWith('/wrong-book?view=danger');
  });
});

describe('WrongQuestionRedoView', () => {
  it('提交后给出继续智能复盘入口，并带上当前选择', async () => {
    let submitPayload: unknown;
    server.use(
      http.get('/api/v2/practice/wrong-questions', () =>
        HttpResponse.json({
          items: [
            makeWrongItem({
              questionId: 42,
              paperCode: 'GW-2025-001',
              stem: '题 42',
            }),
          ],
          total: 1,
          availableSubjects: [],
          availableSubtypes: [],
          page: 1,
          pageSize: 100,
        }),
      ),
      http.post(
        '/api/v2/practice/wrong-questions/42/submit-bluff',
        async ({ request }) => {
          submitPayload = await request.json();
          return HttpResponse.json({
            isCorrect: true,
            bluffDetected: false,
            consecutiveCorrectCount: 2,
            bluffCount: 0,
          });
        },
      ),
    );

    const user = userEvent.setup();
    renderRoute(
      '/wrong-book/42/redo',
      '/wrong-book/:questionId/redo',
      <WrongQuestionRedoView />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wrong-question-redo-view')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('wrong-redo-option-B'));
    await user.click(screen.getByTestId('wrong-redo-submit'));

    await waitFor(() => {
      expect(
        screen.getByTestId('wrong-redo-continue-review'),
      ).toBeInTheDocument();
    });

    expect(submitPayload).toEqual({
      selectedOptionKeys: ['B'],
      durationMs: 0,
    });

    await user.click(screen.getByTestId('wrong-redo-continue-review'));
    expect(mockNavigate).toHaveBeenCalledWith('/wrong-book/smart-review');
  });
});

function renderRoute(
  entry: string,
  path: string,
  element: ReactElement,
) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={element} />
    </Routes>,
    { initialEntries: [entry] },
  );
}

// helper — 给 WrongBook 测试快速构造 WrongQuestionDetailV2.
interface WrongItemPartial {
  readonly questionId: number;
  readonly paperCode: string | null;
  readonly stem: string;
  readonly masteryLevel?: 'not_mastered' | 'reviewing' | 'mastered';
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
    masteryLevel: p.masteryLevel ?? ('reviewing' as const),
    lastWrongTime: '2026-05-01T10:00:00',
    consecutiveCorrectCount: 0,
  };
}
