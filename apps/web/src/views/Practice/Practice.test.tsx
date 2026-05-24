import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Practice } from './Practice';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '../../mocks/server';

function renderPractice() {
  return renderWithProviders(<Practice />, {
    initialEntries: ['/practice'],
  });
}

describe('Practice view (SIK-27)', () => {
  it('renders data state and switches between 行测 / 申论', async () => {
    renderPractice();

    expect(await screen.findByText('Section A · 历史记录 / stats / trend')).toBeInTheDocument();
    expect(screen.getByText('主旨概括')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '申论' }));

    expect(await screen.findByText('归纳概括')).toBeInTheDocument();
  });

  it('opens custom dialog and creates a custom session with defaults', async () => {
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
    expect(await screen.findByText('支持真题 / AI 出题、自定义范围、难度与节奏。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '开始创建' }));

    expect(await screen.findByText('自定义刷题已创建')).toBeInTheDocument();
    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
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
