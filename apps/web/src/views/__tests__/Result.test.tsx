import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
    {
      id: 1,
      questionId: 1,
      selectedAnswerKeys: ['A'],
      correctAnswerKeys: ['A'],
      isCorrect: true,
      answeredAt: '2026-04-28T10:01:00Z',
      wrongReasonCode: null,
      wrongReasonSource: null,
    },
    {
      id: 2,
      questionId: 2,
      selectedAnswerKeys: ['B'],
      correctAnswerKeys: ['C'],
      isCorrect: false,
      answeredAt: '2026-04-28T10:02:00Z',
      wrongReasonCode: 'calculation_error',
      wrongReasonSource: 'ai',
    },
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

describe('Result compact MVP rendering', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json(successFixture),
      ),
    );
  });

  it('renders one-page score summary and key counts', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    await waitFor(() => {
      expect(screen.getByTestId('result-view')).toBeInTheDocument();
    });
    expect(screen.getByTestId('result-score-card')).toBeInTheDocument();
    expect(screen.getByText('2026 国考行测')).toBeInTheDocument();
    expect(screen.getByTestId('result-score-value')).toHaveTextContent('85');
    expect(screen.getByText('正确')).toBeInTheDocument();
    expect(screen.getByText('错误')).toBeInTheDocument();
  });

  it('renders compact review, weak rows, and action cards', async () => {
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    expect(await screen.findByTestId('result-wrong-card')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-review-2')).toBeInTheDocument();
    expect(screen.getByTestId('result-weak-card')).toBeInTheDocument();
    expect(screen.getByTestId('result-notes-action')).toBeInTheDocument();
    expect(screen.getByTestId('result-plan-action')).toBeInTheDocument();
    expect(screen.getByTestId('result-ai-action')).toBeInTheDocument();
  });

  it('back-home action navigates to home', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const btn = await screen.findByTestId('result-back-home');
    await user.click(btn);
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('review action keeps the paperCode filter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const btn = await screen.findByTestId('result-view-wrong');
    await user.click(btn);
    expect(navigateSpy).toHaveBeenCalledWith('/review?paperCode=TEST-001');
  });

  it('saves manual wrong-reason override', async () => {
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

  it('renders retry and home actions on result load failure', async () => {
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
  });

  it('error home action navigates to home', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:id/result', () =>
        HttpResponse.json({ detail: 'not_found' }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Result />, { initialEntries: ['/practice/result/42'] });

    const backBtn = await screen.findByTestId('result-error-home');
    await user.click(backBtn);
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('retry refetch recovers to compact success view', async () => {
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
      expect(screen.getByTestId('result-view')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });
});

describe('Result empty data', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('zero wrong-count renders no-wrong state', async () => {
    const allCorrectFixture = {
      ...successFixture,
      score: 100,
      totalQuestions: 2,
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
          id: 1,
          questionId: 1,
          selectedAnswerKeys: ['A'],
          correctAnswerKeys: ['A'],
          isCorrect: true,
          answeredAt: '2026-04-28T10:01:00Z',
        },
        {
          id: 2,
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

    expect(await screen.findByTestId('result-no-wrong')).toBeInTheDocument();
    expect(screen.queryByTestId('wrong-review-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wrong-review-2')).not.toBeInTheDocument();
  });
});
