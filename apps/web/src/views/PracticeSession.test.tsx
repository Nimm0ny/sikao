import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PracticeSession } from './PracticeSession';
import { server } from '../mocks/server';

function renderPracticeSession(initialEntry = '/practice/sessions/6001') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice/sessions/:sessionId', element: <PracticeSession /> },
      { path: '/practice/sessions/:sessionId/result', element: <div data-testid="result-route-hit" /> },
    ],
    { initialEntries: [initialEntry] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('PracticeSession', () => {
  it('renders the current question and answer sheet', async () => {
    renderPracticeSession();
    expect(await screen.findByTestId('practice-session-view')).toBeInTheDocument();
    expect(screen.getByTestId('answer-sheet')).toBeInTheDocument();
  });

  it('rehydrates selected options and keeps answered cells marked when resuming an existing session', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          entryKind: 'paper',
          examMode: false,
          forceSubmitted: false,
          items: [
            {
              id: '1',
              questionKey: '1001',
              prompt: 'Mock question 1',
              answerKind: 'single_choice',
              status: 'answered',
              selectedAnswerKeys: ['B'],
              answerText: null,
              flagged: false,
              viewedSolution: false,
              hasPersistentFlag: false,
              hasUserNotes: false,
              isFavorited: false,
              isOvertime: false,
              answerChangeCount: 0,
              timeSpentMs: 0,
              visitCount: 0,
            },
            {
              id: '2',
              questionKey: '1002',
              prompt: 'Mock question 2',
              answerKind: 'single_choice',
              status: 'answered',
              selectedAnswerKeys: [],
              answerText: null,
              flagged: false,
              viewedSolution: false,
              hasPersistentFlag: false,
              hasUserNotes: false,
              isFavorited: false,
              isOvertime: false,
              answerChangeCount: 0,
              timeSpentMs: 0,
              visitCount: 0,
            },
          ],
          pausedCount: 0,
          pausedTotalSeconds: 0,
          practiceMode: 'full_set',
          sourceMode: 'paper',
          startedAt: '2026-05-24T08:00:00Z',
          status: 'in_progress',
          totalActiveSeconds: 120,
          track: 'xingce',
          configSnapshot: {},
        }),
      ),
    );

    renderPracticeSession();
    expect(await screen.findByTestId('practice-session-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('B');
    expect(screen.getByTestId('answer-sheet-cell-2').dataset.state).toBe('answered');
  });

  it('rehydrates essay text when resuming an essay session', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          entryKind: 'paper',
          examMode: false,
          forceSubmitted: false,
          items: [
            {
              id: '1',
              questionKey: '1005',
              prompt: 'Essay question',
              answerKind: 'essay',
              status: 'answered',
              selectedAnswerKeys: [],
              answerText: 'Recovered essay draft',
              flagged: false,
              viewedSolution: false,
              hasPersistentFlag: false,
              hasUserNotes: false,
              isFavorited: false,
              isOvertime: false,
              answerChangeCount: 0,
              timeSpentMs: 0,
              visitCount: 0,
            },
          ],
          pausedCount: 0,
          pausedTotalSeconds: 0,
          practiceMode: 'full_set',
          sourceMode: 'paper',
          startedAt: '2026-05-24T08:00:00Z',
          status: 'in_progress',
          totalActiveSeconds: 120,
          track: 'essay',
          configSnapshot: {},
        }),
      ),
    );

    renderPracticeSession();
    expect(await screen.findByTestId('practice-session-view')).toBeInTheDocument();
    expect(screen.getByLabelText('申论作答输入')).toHaveValue('Recovered essay draft');
  });

  it('marks an essay item unanswered after the user clears its text', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          entryKind: 'paper',
          examMode: false,
          forceSubmitted: false,
          items: [
            {
              id: '1',
              questionKey: '1005',
              prompt: 'Essay question 1',
              answerKind: 'essay',
              status: 'pending',
              selectedAnswerKeys: [],
              answerText: null,
              flagged: false,
              viewedSolution: false,
              hasPersistentFlag: false,
              hasUserNotes: false,
              isFavorited: false,
              isOvertime: false,
              answerChangeCount: 0,
              timeSpentMs: 0,
              visitCount: 0,
            },
            {
              id: '2',
              questionKey: '1010',
              prompt: 'Essay question 2',
              answerKind: 'essay',
              status: 'answered',
              selectedAnswerKeys: [],
              answerText: 'Existing draft',
              flagged: false,
              viewedSolution: false,
              hasPersistentFlag: false,
              hasUserNotes: false,
              isFavorited: false,
              isOvertime: false,
              answerChangeCount: 0,
              timeSpentMs: 0,
              visitCount: 0,
            },
          ],
          pausedCount: 0,
          pausedTotalSeconds: 0,
          practiceMode: 'full_set',
          sourceMode: 'paper',
          startedAt: '2026-05-24T08:00:00Z',
          status: 'in_progress',
          totalActiveSeconds: 120,
          track: 'essay',
          configSnapshot: {},
        }),
      ),
    );

    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByTestId('answer-sheet-cell-2'));
    const textarea = screen.getByLabelText('申论作答输入');
    await userEvent.clear(textarea);
    await userEvent.click(screen.getByTestId('answer-sheet-cell-1'));
    expect(screen.getByTestId('answer-sheet-cell-2').dataset.state).toBe('unanswered');
  });

  it('submits and navigates to result route', async () => {
    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(await screen.findByTestId('result-route-hit')).toBeInTheDocument();
  });
});
