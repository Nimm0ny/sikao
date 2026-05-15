import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssayExamSikao from '../EssayExamSikao';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => ({ paperCode: 'AIPTA-2026-01' }),
  };
});

// Phase 3 申论 SIKAO V3 wire test — 同 EssayExam.test.tsx pattern, 把
// EssayShellSikao mock 成最小 harness, 验证 EssayExamSikao 的 query / hydrate
// /handleSubmit 链路 (复用 EssayExam.tsx 整套 pipeline, 只换底层渲染组件).
vi.mock('@/components/essay/sikao', async () => {
  const actual = await vi.importActual<typeof import('@/components/essay/sikao')>(
    '@/components/essay/sikao',
  );
  return {
    ...actual,
    EssayShellSikao: ({
      onSubmit,
      onAutosave,
    }: {
      onSubmit: () => void;
      onAutosave?: () => void;
    }) => (
      <div>
        <button data-testid="mock-shell-sikao-submit" onClick={onSubmit}>
          mock sikao submit
        </button>
        <button data-testid="mock-shell-sikao-autosave" onClick={() => onAutosave?.()}>
          mock sikao autosave
        </button>
      </div>
    ),
  };
});

const mockEssayQuestions = [
  {
    id: 1001,
    position: 1,
    rendererKey: 'essay',
    stemText: '<p>第一题题干</p>',
    explanationText: '<p>要求</p>',
    content: {
      stem: '<p>第一题题干</p>',
      essayMetadata: {
        materialTexts: ['材料一', '材料二'],
        wordLimitMin: 200,
        wordLimitMax: 300,
        suggestedMinutes: 12,
        fullScore: 40,
      },
    },
  },
];

describe('EssayExamSikao', () => {
  it('isError 404 → tone="error" EmptyState with retry + back-papers actions', async () => {
    navigate.mockClear();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    server.use(
      http.get('/api/v2/papers/:code/questions', () =>
        HttpResponse.json({ detail: 'paper not found' }, { status: 404 }),
      ),
    );

    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
      queryClient,
    });

    expect(await screen.findByTestId('essay-exam-retry')).toBeInTheDocument();
    expect(screen.getByTestId('essay-exam-back-papers')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('alert')).toHaveTextContent('试卷加载失败');
  });

  it('renders loading indicator while query is pending', () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', async () => {
        await new Promise(() => {});
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<EssayExamSikao />, { initialEntries: ['/essay/exam/AIPTA-2026-01'] });
    expect(screen.getByTestId('essay-exam-loading')).toBeInTheDocument();
  });

  it('hydrates typed draft from backend essay draft when available', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.get('/api/v2/essay/drafts/:questionId', ({ params }) =>
        HttpResponse.json({
          id: 1,
          questionId: Number(params.questionId),
          typedDraft: '后端草稿内容',
          handwrittenDraftMetadata: null,
          savedAt: '2026-05-14T00:00:00Z',
          updatedAt: '2026-05-14T00:00:00Z',
        }),
      ),
    );

    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });
    expect(useExamSession.getState().textsByQ[0]).toBe('后端草稿内容');
  });

  it('ignores essay draft load failure and still renders the exam shell', async () => {
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.get('/api/v2/essay/drafts/:questionId', () =>
        HttpResponse.json({ detail: 'draft boom' }, { status: 500 }),
      ),
    );

    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });
  });

  it('autosave syncs typed draft to backend essay drafts', async () => {
    let savedDraftBody: { questionId: number; typedDraft: string } | null = null;
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.post('/api/v2/essay/drafts', async ({ request }) => {
        savedDraftBody = (await request.json()) as {
          questionId: number;
          typedDraft: string;
        };
        return HttpResponse.json({
          id: 1,
          questionId: savedDraftBody.questionId,
          typedDraft: savedDraftBody.typedDraft,
          handwrittenDraftMetadata: null,
          savedAt: '2026-05-14T00:00:00Z',
          updatedAt: '2026-05-14T00:00:00Z',
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });

    useExamSession.setState({
      textsByQ: ['本次自动保存正文'],
      phase: 'running',
    });

    await user.click(screen.getByTestId('mock-shell-sikao-autosave'));

    await waitFor(() => {
      expect(savedDraftBody).toEqual({
        questionId: 1001,
        typedDraft: '本次自动保存正文',
        handwrittenDraftMetadata: null,
      });
    });
  });

  it('autosave preserves existing handwritten draft metadata', async () => {
    let savedDraftBody: {
      questionId: number;
      typedDraft: string;
      handwrittenDraftMetadata: Record<string, unknown> | null;
    } | null = null;
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.get('/api/v2/essay/drafts/:questionId', ({ params }) =>
        HttpResponse.json({
          id: 2,
          questionId: Number(params.questionId),
          typedDraft: '旧稿',
          handwrittenDraftMetadata: { asset_id: 7, stroke_count: 12 },
          savedAt: '2026-05-14T00:00:00Z',
          updatedAt: '2026-05-14T00:00:00Z',
        }),
      ),
      http.post('/api/v2/essay/drafts', async ({ request }) => {
        savedDraftBody = (await request.json()) as {
          questionId: number;
          typedDraft: string;
          handwrittenDraftMetadata: Record<string, unknown> | null;
        };
        return HttpResponse.json({
          id: 2,
          questionId: savedDraftBody.questionId,
          typedDraft: savedDraftBody.typedDraft,
          handwrittenDraftMetadata: savedDraftBody.handwrittenDraftMetadata,
          savedAt: '2026-05-14T00:00:00Z',
          updatedAt: '2026-05-14T00:00:00Z',
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });

    useExamSession.setState({
      textsByQ: ['新正文'],
      phase: 'running',
    });

    await user.click(screen.getByTestId('mock-shell-sikao-autosave'));

    await waitFor(() => {
      expect(savedDraftBody).toEqual({
        questionId: 1001,
        typedDraft: '新正文',
        handwrittenDraftMetadata: { asset_id: 7, stroke_count: 12 },
      });
    });
  });

  it('handleSubmit success → navigate to /essay/exam/results with paperCode/ids/total', async () => {
    navigate.mockClear();
    let analyticsBody: { eventName: string; properties?: Record<string, string> } | null = null;
    let patchedTaskBody: { status: string } | null = null;
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.post('/api/v2/analytics/event', async ({ request }) => {
        analyticsBody = (await request.json()) as {
          eventName: string;
          properties?: Record<string, string>;
        };
        return HttpResponse.json({ received: true }, { status: 202 });
      }),
      http.patch('/api/v2/study-plan/tasks/:taskId', async ({ request }) => {
        patchedTaskBody = (await request.json()) as { status: string };
        return HttpResponse.json({
          id: 9,
          taskKind: 'essay_writing',
          payload: {
            paperCode: 'AIPTA-2026-01',
            questionId: 1001,
            title: '申论任务',
            subtitle: null,
          },
          displayOrder: 0,
          status: 'completed',
          completedAt: '2026-05-14T00:00:00Z',
          createdAt: '2026-05-14T00:00:00Z',
        });
      }),
      http.post('/api/v2/essay/grade', async ({ request }) => {
        const body = (await request.json()) as { questionId: number };
        return HttpResponse.json({
          id: body.questionId,
          questionId: body.questionId,
          answerText: '...',
          status: 'pending',
          score: null,
          feedback: null,
          failureReason: null,
          createdAt: new Date().toISOString(),
          gradedAt: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<EssayExamSikao />, {
      initialEntries: [
        {
          pathname: '/essay/exam/AIPTA-2026-01',
          state: { studyTaskId: 9 },
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });

    useExamSession.setState({
      textsByQ: ['答案一'.repeat(50)],
      phase: 'running',
    });

    await user.click(screen.getByTestId('mock-shell-sikao-submit'));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalled();
    });
    const navUrl = navigate.mock.calls[0][0] as string;
    expect(navUrl).toContain('/essay/exam/results');
    expect(navUrl).toContain('paperCode=AIPTA-2026-01');
    expect(navUrl).toContain('ids=1001');
    expect(navUrl).toContain('total=1');
    expect(patchedTaskBody).toEqual({ status: 'completed' });
    expect(analyticsBody).toEqual({
      eventName: 'essay_exam_submitted',
      sessionId: 'AIPTA-2026-01',
      properties: {
        paperCode: 'AIPTA-2026-01',
        totalQuestions: '1',
        submittedRecords: '1',
        studyTaskId: '9',
      },
    });
  });

  it('handleSubmit failure → phase rolled back to running (user can retry)', async () => {
    navigate.mockClear();
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
      http.post('/api/v2/essay/grade', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<EssayExamSikao />, {
      initialEntries: ['/essay/exam/AIPTA-2026-01'],
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-sikao-submit')).toBeInTheDocument();
    });

    useExamSession.setState({
      textsByQ: ['答案一'.repeat(50)],
      phase: 'running',
    });

    await user.click(screen.getByTestId('mock-shell-sikao-submit'));

    await waitFor(() => {
      expect(useExamSession.getState().phase).toBe('running');
    });
    expect(useExamSession.getState().phase).not.toBe('submitted');
    const resultsCall = navigate.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('/essay/exam/results'),
    );
    expect(resultsCall).toBeUndefined();
  });
});
