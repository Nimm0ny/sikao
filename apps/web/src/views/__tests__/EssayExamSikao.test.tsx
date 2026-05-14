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
    EssayShellSikao: ({ onSubmit }: { onSubmit: () => void }) => (
      <button data-testid="mock-shell-sikao-submit" onClick={onSubmit}>
        mock sikao submit
      </button>
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

  it('handleSubmit success → navigate to /essay/exam/results with paperCode/ids/total', async () => {
    navigate.mockClear();
    server.use(
      http.get('/api/v2/papers/:code/questions', () => HttpResponse.json(mockEssayQuestions)),
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
      expect(navigate).toHaveBeenCalled();
    });
    const navUrl = navigate.mock.calls[0][0] as string;
    expect(navUrl).toContain('/essay/exam/results');
    expect(navUrl).toContain('paperCode=AIPTA-2026-01');
    expect(navUrl).toContain('ids=1001');
    expect(navUrl).toContain('total=1');
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
