import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../mocks/server';
import { EssayGradingResult } from './EssayGradingResult';

function renderEssayGrading(initialEntry = '/practice/sessions/6001/grading') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice', element: <div data-testid="practice-route-hit" /> },
      { path: '/practice/sessions/:sessionId', element: <div data-testid="practice-session-route-hit" /> },
      { path: '/practice/sessions/:sessionId/grading', element: <EssayGradingResult /> },
      { path: '/practice/essay/submissions/:submissionId/grading-status', element: <EssayGradingResult /> },
      { path: '/practice/essay/submissions/:submissionId/result', element: <EssayGradingResult /> },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('EssayGradingResult', () => {
  it('auto-triggers grading from the canonical session route and renders the completed report', async () => {
    let pollsRemaining = 1;
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          track: 'essay',
          entryKind: 'paper',
          status: 'submitted',
          essaySubmissionId: 9001,
          items: [],
          startedAt: '2026-05-24T08:00:00Z',
          practiceMode: 'full_set',
          sourceMode: 'paper',
          configSnapshot: {},
          pausedCount: 0,
          pausedTotalSeconds: 0,
          totalActiveSeconds: 0,
          examMode: false,
        }),
      ),
      http.post('/api/v2/practice/essay/submissions/:submissionId/grade', () =>
        HttpResponse.json({
          submissionId: 9001,
          status: 'pending_grading',
          report: null,
          referenceAnswers: [],
          errorMessage: null,
        }),
      ),
      http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', () => {
        if (pollsRemaining > 0) {
          pollsRemaining -= 1;
          return HttpResponse.json({
            submissionId: 9001,
            status: 'pending_grading',
            report: null,
            referenceAnswers: [],
            errorMessage: null,
          });
        }
        return HttpResponse.json({
          submissionId: 9001,
          status: 'graded',
          report: {
            totalScore: 76,
            dimensions: [{ name: '结构', score: 20, fullScore: 25, comment: '结构稳定。' }],
            highlights: ['中心明确'],
            issues: ['论据略少'],
            overallComment: '总体可用。',
            improvementSuggestions: ['补一段论据'],
            gradedAt: '2026-05-25T08:00:00Z',
            llmCallId: 9001,
          },
          referenceAnswers: [
            {
              id: 10001,
              questionId: 1005,
              content: '参考答案示例：先概括问题，再提出三条对策，最后收束到执行闭环。',
              source: 'ai_generated',
              likesCount: 0,
              favoritesCount: 0,
              reportCount: 0,
              qualityScore: 0.92,
              status: 'public',
              publishedAt: '2026-05-25T08:00:00Z',
            },
          ],
          errorMessage: null,
        });
      }),
    );
    renderEssayGrading();

    expect(await screen.findByTestId('essay-grading-view')).toBeInTheDocument();
    expect(await screen.findByText('Total score', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('76')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('参考答案示例：先概括问题，再提出三条对策，最后收束到执行闭环。')).toBeInTheDocument();
  });

  it('renders the legacy submission route directly', async () => {
    server.use(
      http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', () =>
        HttpResponse.json({
          submissionId: 9001,
          status: 'graded',
          report: {
            totalScore: 76,
            dimensions: [{ name: '结构', score: 20, fullScore: 25, comment: '结构稳定。' }],
            highlights: ['中心明确'],
            issues: ['论据略少'],
            overallComment: '总体可用。',
            improvementSuggestions: ['补一段论据'],
            gradedAt: '2026-05-25T08:00:00Z',
            llmCallId: 9001,
          },
          referenceAnswers: [],
          errorMessage: null,
        }),
      ),
    );
    renderEssayGrading('/practice/essay/submissions/9001/grading-status');

    expect(await screen.findByTestId('essay-grading-view')).toBeInTheDocument();
    expect(await screen.findByText('Essay grading · Submission #9001')).toBeInTheDocument();
  });

  it('shows a retry affordance when grading fails', async () => {
    let gradeCalls = 0;
    server.use(
      http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', () =>
        HttpResponse.json({
          submissionId: 9102,
          status: 'failed',
          report: null,
          referenceAnswers: [],
          errorMessage: 'grading failed',
        }),
      ),
      http.post('/api/v2/practice/essay/submissions/:submissionId/grade', () => {
        gradeCalls += 1;
        return HttpResponse.json({
          submissionId: 9102,
          status: 'pending_grading',
          report: null,
          referenceAnswers: [],
          errorMessage: null,
        });
      }),
    );

    renderEssayGrading('/practice/essay/submissions/9102/grading-status');
    expect(await screen.findByText('Grading failed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry grading' }));
    await waitFor(() => {
      expect(gradeCalls).toBe(1);
    });
  });

  it('surfaces a retry when the initial grading trigger fails from submitted state', async () => {
    let triggerCalls = 0;
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          track: 'essay',
          entryKind: 'paper',
          status: 'submitted',
          essaySubmissionId: 9103,
          items: [],
          startedAt: '2026-05-24T08:00:00Z',
          practiceMode: 'full_set',
          sourceMode: 'paper',
          configSnapshot: {},
          pausedCount: 0,
          pausedTotalSeconds: 0,
          totalActiveSeconds: 0,
          examMode: false,
        }),
      ),
      http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', () =>
        HttpResponse.json({
          submissionId: 9103,
          status: 'submitted',
          report: null,
          referenceAnswers: [],
          errorMessage: null,
        }),
      ),
      http.post('/api/v2/practice/essay/submissions/:submissionId/grade', () => {
        triggerCalls += 1;
        return HttpResponse.json({ detail: 'boom' }, { status: 500 });
      }),
    );

    renderEssayGrading('/practice/sessions/6001/grading');
    expect(await screen.findByText('Grading kickoff failed')).toBeInTheDocument();
    expect(triggerCalls).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Retry grading' }));
    await waitFor(() => {
      expect(triggerCalls).toBe(2);
    });
  });
});
