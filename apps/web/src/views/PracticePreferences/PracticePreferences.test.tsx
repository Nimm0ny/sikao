import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { PracticePreferences } from './PracticePreferences';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '../../mocks/server';

function renderPreferences() {
  return renderWithProviders(<PracticePreferences />, {
    initialEntries: ['/profile/practice-preferences'],
  });
}

function buildPreferencesPayload(overrides?: {
  readonly themePreference?: 'system' | 'light' | 'dark';
  readonly lastUsedCount?: 5 | 10 | 15 | 20 | 30;
}) {
  return {
    ui: {
      answerPanelPosition: 'right',
      fontSize: 'base',
      lineHeight: 'comfortable',
      showOvertimeWarning: true,
      showQuestionIndex: true,
      showTimingIndicator: true,
      themePreference: overrides?.themePreference ?? 'system',
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
      lastUsedCount: overrides?.lastUsedCount ?? 10,
      lastUsedPracticeMode: 'full_set',
      lastUsedExcludeDone: true,
      lastUsedOnlyWrong: false,
    },
  };
}

describe('PracticePreferences view (SIK-27)', () => {
  async function waitForLoadedState() {
    await screen.findByTestId('practice-preferences-view');
    await waitFor(() => {
      expect(screen.queryAllByText('加载中')).toHaveLength(0);
    }, { timeout: 5000 });
  }

  it('loads preferences data and renders section panels', async () => {
    renderPreferences();
    await waitForLoadedState();

    expect(screen.getByRole('button', { name: '保存设置' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading').length).toBeGreaterThanOrEqual(3);
  });

  it('hides keyboard editor on mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    window.dispatchEvent(new Event('resize'));

    renderPreferences();
    await waitForLoadedState();

    expect(screen.queryByText(/Ctrl\+Enter/)).toBeNull();
  });

  it('reloads latest payload when save hits schema mismatch', async () => {
    let latestVersion = false;
    server.use(
      http.get('/api/v2/profile/practice-preferences', () =>
        HttpResponse.json({
          isDefault: false,
          schemaVersion: 1,
          updatedAt: latestVersion ? '2026-05-24T12:00:00Z' : '2026-05-24T00:00:00Z',
          payload: buildPreferencesPayload({
            themePreference: latestVersion ? 'dark' : 'system',
            lastUsedCount: latestVersion ? 20 : 10,
          }),
        }),
      ),
      http.put('/api/v2/profile/practice-preferences', () => {
        latestVersion = true;
        return HttpResponse.json(
          { code: 'schema_version_mismatch', schemaVersion: 1, detail: 'schema mismatch' },
          { status: 422 },
        );
      }),
    );

    renderPreferences();
    await waitForLoadedState();
    await userEvent.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() => {
      expect(screen.getByText('已加载最新配置')).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: '主题' })).toHaveTextContent('深色');
  });

  it('debounced patch settles after one successful sync for a single edit', async () => {
    let patchCount = 0;
    server.use(
      http.patch('/api/v2/profile/practice-preferences', async ({ request }) => {
        patchCount += 1;
        const body = await request.json();
        const themePatch = (body as { patches: Array<{ path: string; value: unknown }> }).patches.find(
          (item) => item.path === 'ui.themePreference',
        );
        return HttpResponse.json({
          schemaVersion: 1,
          updatedAt: '2026-05-24T12:00:00Z',
          payload: buildPreferencesPayload({
            themePreference: themePatch?.value === 'dark' ? 'dark' : 'system',
          }),
        });
      }),
    );

    renderPreferences();
    await waitForLoadedState();
    const theme = screen.getByRole('combobox', { name: '主题' });
    await userEvent.click(theme);
    await userEvent.click(await screen.findByRole('option', { name: '深色' }));

    await waitFor(() => {
      expect(patchCount).toBe(1);
    });
  });

  it('ignores an in-flight stale patch after reset', async () => {
    let patchCount = 0;
    let resolvePatch: (() => void) | null = null;

    server.use(
      http.patch('/api/v2/profile/practice-preferences', async ({ request }) => {
        patchCount += 1;
        const body = await request.json();
        const themePatch = (body as { patches: Array<{ path: string; value: unknown }> }).patches.find(
          (item) => item.path === 'ui.themePreference',
        );
        return new Promise((resolve) => {
          resolvePatch = () =>
            resolve(
              HttpResponse.json({
                schemaVersion: 1,
                updatedAt: '2026-05-24T12:00:01Z',
                payload: buildPreferencesPayload({ themePreference: themePatch?.value === 'dark' ? 'dark' : 'system' }),
              }),
            );
        });
      }),
      http.post('/api/v2/profile/practice-preferences/reset', () =>
        HttpResponse.json({
          schemaVersion: 1,
          updatedAt: '2026-05-24T12:00:02Z',
          payload: buildPreferencesPayload({ themePreference: 'system' }),
        }),
      ),
    );

    renderPreferences();
    await waitForLoadedState();
    const theme = screen.getByRole('combobox', { name: '主题' });
    await userEvent.click(theme);
    await userEvent.click(await screen.findByRole('option', { name: '深色' }));

    await waitFor(() => {
      expect(patchCount).toBe(1);
      expect(resolvePatch).not.toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: '恢复默认' }));
    resolvePatch?.();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '主题' })).toHaveTextContent('跟随系统');
    });
  });
});
