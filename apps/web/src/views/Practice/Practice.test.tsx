import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { Practice } from './Practice';
import { server } from '../../mocks/server';

function AiGeneratingRouteProbe() {
  const location = useLocation();
  return <div data-testid="ai-generating-route-hit">{location.search}</div>;
}

function renderPractice() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice', element: <Practice /> },
      { path: '/practice/sessions/:sessionId', element: <div data-testid="practice-session-route-hit" /> },
      { path: '/practice/ai-questions/generating', element: <AiGeneratingRouteProbe /> },
    ],
    { initialEntries: ['/practice'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Practice view (SIK-27/28)', () => {
  it('renders data state and switches between 行测 / 申论', async () => {
    renderPractice();

    expect(await screen.findByText('Section A · 历史记录 / stats / trend')).toBeInTheDocument();
    expect(screen.getByText('主旨概括')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '申论' }));

    expect(await screen.findByText('归纳概括')).toBeInTheDocument();
  });

  it('opens custom dialog and navigates to the runtime session after create', async () => {
    let patchBody: unknown = null;
    server.use(
      http.patch('/api/v2/profile/practice-preferences', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({
          schemaVersion: 1,
          updatedAt: '2026-05-24T00:00:00Z',
          payload: {
            ui: {
              answerPanelPosition: 'right',
              fontSize: 'base',
              lineHeight: 'comfortable',
              showOvertimeWarning: true,
              showQuestionIndex: true,
              showTimingIndicator: true,
              themePreference: 'system',
            },
            pacing: {
              autoAdvanceAfterAnswer: false,
              autoAdvanceDelaySeconds: 1,
              confirmBeforeSubmit: true,
              confirmWhenUnansweredCountGte: 1,
              defaultPracticeMode: 'full_set',
            },
            autoSave: {
              enabled: true,
              intervalSeconds: 30,
              saveToLocalStorage: true,
            },
            keyboard: {
              enabled: true,
              bindings: {
                selectA: 'a',
                selectB: 'b',
                selectC: 'c',
                selectD: 'd',
                nextQuestion: 'ArrowRight',
                prevQuestion: 'ArrowLeft',
                flagUncertain: 'f',
                favorite: 's',
                note: 'n',
                submit: 'Ctrl+Enter',
              },
            },
            reminders: {
              dailyPracticeReminderEnabled: false,
              dailyPracticeReminderTime: '20:00',
              weeklySummaryReminderEnabled: false,
              overtimeThresholdSeconds: 0,
              longSessionBreakReminderMinutes: 0,
            },
            customPractice: {
              lastUsedSourceMode: 'real_exam',
              lastUsedYearRange: 'recent_3',
              lastUsedDifficultyRange: [0, 1],
              lastUsedCount: 10,
              lastUsedPracticeMode: 'full_set',
              lastUsedExcludeDone: true,
              lastUsedOnlyWrong: false,
            },
          },
        });
      }),
    );

    renderPractice();

    await userEvent.click(await screen.findByRole('button', { name: '自定义刷题' }));
    expect(await screen.findByRole('button', { name: '开始创建' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '开始创建' }));

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
    expect(await screen.findByTestId('practice-session-route-hit')).toBeInTheDocument();
  });

  it('navigates to the AI generating route when custom practice uses AI mode', async () => {
    renderPractice();

    await userEvent.click(await screen.findByRole('button', { name: /自定义刷题/ }));
    await userEvent.click(screen.getByDisplayValue('ai_generated'));
    await userEvent.click(screen.getByRole('button', { name: /开始创建/ }));

    const routeProbe = await screen.findByTestId('ai-generating-route-hit');
    expect(routeProbe).toHaveTextContent('type=essay');
    expect(routeProbe).toHaveTextContent('practiceMode=full_set');
    expect(routeProbe).toHaveTextContent('excludeDone=true');
    expect(routeProbe).toHaveTextContent('onlyWrong=false');
  });

  it('navigates to the active runtime session from continue-last quick action', async () => {
    renderPractice();

    await userEvent.click(await screen.findByRole('button', { name: /继续/ }));

    expect(await screen.findByTestId('practice-session-route-hit')).toBeInTheDocument();
  });

  it('renders page-level error state when stats request fails', async () => {
    server.use(
      http.get('/api/v2/practice/center', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 403 }),
      ),
      http.get('/api/v2/practice/stats', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 403 }),
      ),
    );

    renderPractice();

    expect(await screen.findByText('练习中心加载失败')).toBeInTheDocument();
  });
});
