import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PracticeSession } from './PracticeSession';
import { server } from '../mocks/server';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderPracticeSession(initialEntry = '/practice/sessions/6001') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice', element: <div data-testid="practice-route-hit" /> },
      { path: '/practice/sessions/:sessionId', element: <PracticeSession /> },
      { path: '/practice/sessions/:sessionId/result', element: <div data-testid="result-route-hit" /> },
      { path: '/practice/sessions/:sessionId/grading', element: <div data-testid="grading-route-hit" /> },
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
    expect(screen.getByLabelText('Essay answer input')).toHaveValue('Recovered essay draft');
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
    const textarea = screen.getByLabelText('Essay answer input');
    await userEvent.clear(textarea);
    await userEvent.click(screen.getByTestId('answer-sheet-cell-1'));
    expect(screen.getByTestId('answer-sheet-cell-2').dataset.state).toBe('unanswered');
  });

  it('toggles pause and resume through lifecycle controls', async () => {
    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('requires explicit confirmation before starting a mock exam draft', async () => {
    let started = false;
    let startCalls = 0;
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          entryKind: 'mock_exam',
          examMode: true,
          forceSubmitted: false,
          items: [
            {
              id: '1',
              questionKey: '1001',
              prompt: 'Mock question 1',
              answerKind: 'single_choice',
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
          ],
          pausedCount: 0,
          pausedTotalSeconds: 0,
          practiceMode: 'full_set',
          sourceMode: 'paper',
          startedAt: '2026-05-24T08:00:00Z',
          status: started ? 'in_progress' : 'draft',
          totalActiveSeconds: 0,
          track: 'xingce',
          configSnapshot: {},
        }),
      ),
      http.get('/api/v2/practice/sessions/:sessionId/lifecycle', () =>
        HttpResponse.json({
          status: started ? 'in_progress' : 'draft',
          pausedCount: 0,
          pausedTotalSeconds: 0,
          forceSubmitted: false,
          transitions: [],
        }),
      ),
      http.post('/api/v2/practice/sessions/:sessionId/start', () => {
        startCalls += 1;
        started = true;
        return HttpResponse.json({
          status: 'in_progress',
          pausedCount: 0,
          pausedTotalSeconds: 0,
          forceSubmitted: false,
          firstQuestionAt: '2026-05-24T08:00:00Z',
          transitions: [],
        });
      }),
    );

    renderPracticeSession();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Start mock exam?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start mock exam' }));
    await waitFor(() => {
      expect(startCalls).toBe(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByTestId('practice-session-view')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Status:\s*in_progress/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('does not send heartbeat ticks while the session is paused', async () => {
    let heartbeatCalls = 0;
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

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
              selectedAnswerKeys: ['A'],
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
          pausedCount: 1,
          pausedTotalSeconds: 300,
          practiceMode: 'full_set',
          sourceMode: 'paper',
          startedAt: '2026-05-24T08:00:00Z',
          status: 'paused',
          totalActiveSeconds: 120,
          track: 'xingce',
          configSnapshot: {},
        }),
      ),
      http.get('/api/v2/practice/sessions/:sessionId/lifecycle', () =>
        HttpResponse.json({
          status: 'paused',
          pausedAt: '2026-05-24T08:05:00Z',
          pausedCount: 1,
          pausedTotalSeconds: 300,
          forceSubmitted: false,
          transitions: [],
        }),
      ),
      http.post('/api/v2/practice/sessions/:sessionId/heartbeat', () => {
        heartbeatCalls += 1;
        return HttpResponse.json({
          serverTs: new Date().toISOString(),
          status: 'paused',
        });
      }),
    );

    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    const heartbeatIntervals = setIntervalSpy.mock.calls.filter((call) => call[1] === 30_000);
    expect(heartbeatIntervals).toHaveLength(0);
    expect(heartbeatCalls).toBe(0);
  });

  it('sends an explicit empty heartbeat body when the active interval fires', async () => {
    let heartbeatBody: unknown = null;
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    server.use(
      http.post('/api/v2/practice/sessions/:sessionId/heartbeat', async ({ request }) => {
        heartbeatBody = await request.json();
        return HttpResponse.json({
          serverTs: new Date().toISOString(),
          status: 'in_progress',
        });
      }),
    );

    renderPracticeSession();
    await screen.findByTestId('practice-session-view');

    const heartbeatRegistration = setIntervalSpy.mock.calls.find((call) => call[1] === 30_000);
    expect(heartbeatRegistration).toBeDefined();
    const intervalCallback = heartbeatRegistration?.[0];
    expect(typeof intervalCallback).toBe('function');

    await act(async () => {
      await (intervalCallback as () => void)();
      await Promise.resolve();
    });

    expect(heartbeatBody).toEqual({});
  });

  it('discards the runtime session and returns to practice center', async () => {
    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(await screen.findByTestId('practice-route-hit')).toBeInTheDocument();
  });

  it('submits and navigates to result route', async () => {
    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByTestId('result-route-hit')).toBeInTheDocument();
  });

  it('submits an essay session and navigates to the result route', async () => {
    let submitted = false;
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          entryKind: 'paper',
          essaySubmissionId: submitted ? 9101 : null,
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
              answerText: 'Essay draft',
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
      http.post('/api/v2/practice/sessions/:sessionId/submit', () => {
        submitted = true;
        return HttpResponse.json({ ok: true, status: 'submitted' });
      }),
    );

    renderPracticeSession();
    await screen.findByTestId('practice-session-view');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByTestId('result-route-hit')).toBeInTheDocument();
  });
});
