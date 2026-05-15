import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import Result from '../Result';

const successFixture = {
  sessionId: 42,
  paperCode: 'TEST-001',
  paperRevisionId: 1,
  mode: 'free',
  score: 85,
  totalQuestions: 100,
  correctCount: 85,
  incorrectCount: 10,
  unansweredCount: 5,
  userAnswers: {},
  session: {
    sessionId: 42,
    mode: 'free',
    paperCode: 'TEST-001',
    paperName: '2026 国考行测',
    startedAt: '2026-04-28T10:00:00Z',
    completedAt: '2026-04-28T11:30:00Z',
    totalQuestions: 100,
    answeredQuestions: 95,
    correctCount: 85,
    wrongCount: 10,
    accuracyRate: 85,
  },
  sectionSummaries: [
    {
      sectionId: 's1',
      title: '言语理解',
      instructionText: '',
      questionCount: 25,
      answeredQuestions: 25,
      correctCount: 22,
      wrongCount: 3,
      accuracyRate: 88,
    },
  ],
  subjectSummaries: [
    {
      subject: '言语理解',
      questionCount: 25,
      answeredQuestions: 25,
      correctCount: 22,
      wrongCount: 3,
      accuracyRate: 88,
    },
    {
      subject: '数量关系',
      questionCount: 15,
      answeredQuestions: 15,
      correctCount: 8,
      wrongCount: 7,
      accuracyRate: 53.3,
    },
  ],
  subtypeSummaries: [
    {
      subject: '言语理解',
      subtype: '片段阅读',
      questionCount: 12,
      answeredQuestions: 12,
      correctCount: 10,
      wrongCount: 2,
      accuracyRate: 83.3,
    },
  ],
  answers: [
    { id: 1, questionId: 1, selectedAnswerKeys: ['A'], correctAnswerKeys: ['A'], isCorrect: true, answeredAt: '2026-04-28T10:01:00Z', wrongReasonCode: null, wrongReasonSource: null },
    { id: 2, questionId: 2, selectedAnswerKeys: ['B'], correctAnswerKeys: ['C'], isCorrect: false, answeredAt: '2026-04-28T10:02:00Z', wrongReasonCode: null, wrongReasonSource: null },
  ],
  questions: [
    {
      questionId: 1,
      subject: '言语理解',
      canonicalSubtype: '片段阅读',
      paperRevisionId: '1',
      sectionId: 's1',
      blockId: 'b1',
      questionNo: 1,
      questionKind: 'single_choice',
      rendererKey: 'single_choice',
      content: { stem: '题目 1' },
    },
    {
      questionId: 2,
      subject: '数量关系',
      canonicalSubtype: '数学运算',
      paperRevisionId: '1',
      sectionId: 's1',
      blockId: 'b1',
      questionNo: 2,
      questionKind: 'single_choice',
      rendererKey: 'single_choice',
      content: { stem: '题目 2' },
    },
  ],
};

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => ({ sessionId: '42' }),
  };
});

describe('Result success rendering', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json(successFixture),
      ),
    );
  });

  it('renders ScoreHero with paper name and big score', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('result-header')).toBeInTheDocument();
    });
    expect(screen.getByText('2026 国考行测')).toBeInTheDocument();
    expect(screen.getByText('答题报告')).toBeInTheDocument();
    expect(screen.getByTestId('hero-score-value')).toBeInTheDocument();
  });

  it('renders ScoreHero meta with submitted time and duration', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('result-header')).toBeInTheDocument();
    });
    const header = screen.getByTestId('result-header');
    expect(within(header).getByText(/提交于/)).toBeInTheDocument();
    expect(within(header).getByTestId('hero-meta-duration')).toBeInTheDocument();
  });

  it('renders ScoreModuleCard with score and counts', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('score-module-card')).toBeInTheDocument();
    });
    expect(screen.getByText('成绩概况')).toBeInTheDocument();
    const correct = screen.getByTestId('score-tile-success');
    expect(within(correct).getByText('85')).toBeInTheDocument();
  });

  it('renders AiSuggestionCard in left column', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('ai-suggestion-card')).toBeInTheDocument();
    });
  });

  it('renders AnswerComparisonGrid', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('answer-comparison-grid')).toBeInTheDocument();
    });
  });

  it('classifies matrix cells from result answers when userAnswers is empty', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    const first = await screen.findByTestId('compare-cell-1');
    const second = await screen.findByTestId('compare-cell-2');
    expect(first).toHaveAttribute('data-state', 'correct');
    expect(second).toHaveAttribute('data-state', 'wrong');
  });

  it('renders ResultActions with back-home and retry buttons', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('result-actions')).toBeInTheDocument();
    });
    expect(screen.getByTestId('result-back-home')).toBeInTheDocument();
    expect(screen.getByTestId('result-retry')).toBeInTheDocument();
  });

  it('renders export PDF button stub', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    await waitFor(() => {
      expect(screen.getByTestId('result-export-pdf')).toBeInTheDocument();
    });
  });

  it('uses the Figma matrix-review layout order', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    const grid = await screen.findByTestId('result-matrix-review-grid');
    expect(grid).toHaveClass('md:grid-cols-[minmax(0,744px)_minmax(320px,432px)]');
    expect(screen.getByTestId('result-score-region')).toBeInTheDocument();
    expect(screen.getByTestId('result-ai-region')).toBeInTheDocument();
    expect(screen.getByTestId('result-matrix-region')).toBeInTheDocument();
    expect(screen.getByTestId('result-wrong-region')).toBeInTheDocument();
  });

  it('shows continue review action in the header', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    const btn = await screen.findByTestId('result-continue-review');
    expect(btn).toHaveTextContent('逐题回顾');
  });

  it('back-home button navigates to /app', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });
    const btn = await screen.findByTestId('result-back-home');
    await user.click(btn);
    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('shows wrong-reason diagnosis and saves manual override', async () => {
    const user = userEvent.setup();
    let patchedBody: { wrongReasonCode: string; source: string } | null = null;
    server.use(
      http.patch(
        '/api/v2/practice/sessions/:sessionId/answers/:answerId/diagnosis',
        async ({ request }) => {
          patchedBody = (await request.json()) as {
            wrongReasonCode: string;
            source: string;
          };
          return HttpResponse.json({
            answerId: 2,
            wrongReasonCode: patchedBody.wrongReasonCode,
            wrongReasonSource: patchedBody.source,
          });
        },
      ),
    );

    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const select = await screen.findByTestId('wrong-reason-select-2');
    expect(select).toHaveValue('calculation_error');
    await user.selectOptions(select, 'careless_mistake');
    await waitFor(() => {
      expect(patchedBody).toEqual({
        wrongReasonCode: 'careless_mistake',
        source: 'user',
      });
    });
  });
});

describe('Result error fallback', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('isError → tone="error" EmptyState with retry + back-home actions', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json({ detail: 'not_found' }, { status: 404 }),
      ),
    );

    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    await waitFor(() => {
      expect(screen.getByTestId('result-retry')).toBeInTheDocument();
    });
    expect(screen.getByTestId('result-error-home')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('报告加载失败');
  });

  it('result-error-home button click navigates to /app', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json({ detail: 'not_found' }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const backBtn = await screen.findByTestId('result-error-home');
    await user.click(backBtn);
    expect(navigateSpy).toHaveBeenCalledWith('/app');
  });

  it('clicking retry refetches and recovers to success render', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json({ detail: 'transient' }, { status: 503 });
        }
        return HttpResponse.json(successFixture);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const retry = await screen.findByTestId('result-retry');
    await user.click(retry);

    await waitFor(() => {
      expect(screen.getByTestId('result-header')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });
});

describe('Result empty data', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('zero wrong-count: matrix renders only correct cells, no wrong-review article', async () => {
    const allCorrectFixture = {
      ...successFixture,
      score: 100,
      correctCount: 2,
      incorrectCount: 0,
      unansweredCount: 0,
      session: {
        ...successFixture.session,
        totalQuestions: 2,
        answeredQuestions: 2,
        correctCount: 2,
        wrongCount: 0,
        accuracyRate: 100,
      },
      answers: [
        {
          questionId: 1,
          selectedAnswerKeys: ['A'],
          correctAnswerKeys: ['A'],
          isCorrect: true,
          answeredAt: '2026-04-28T10:01:00Z',
        },
        {
          questionId: 2,
          selectedAnswerKeys: ['C'],
          correctAnswerKeys: ['C'],
          isCorrect: true,
          answeredAt: '2026-04-28T10:02:00Z',
        },
      ],
    };
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json(allCorrectFixture),
      ),
    );

    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const first = await screen.findByTestId('compare-cell-1');
    expect(first).toHaveAttribute('data-state', 'correct');
    expect(screen.getByTestId('compare-cell-2')).toHaveAttribute('data-state', 'correct');
    // No wrong-review-N articles when nothing was wrong.
    expect(screen.queryByTestId('wrong-review-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wrong-review-2')).not.toBeInTheDocument();
  });
});
