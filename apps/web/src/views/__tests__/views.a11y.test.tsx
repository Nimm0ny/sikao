import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { Home } from '../Home';
import { Practice } from '../Practice';
import { AiQuestionsGenerating } from '../AiQuestionsGenerating';
import { EssayGradingResult } from '../EssayGradingResult';
import { Note } from '../Note';
import { Me } from '../Me';
import { PracticePreferences } from '../PracticePreferences';
import { QuestionHub } from '../QuestionHub';
import { PracticeSession } from '../PracticeSession';
import { Review } from '../Review';
import { SessionResult } from '../SessionResult';
import { ProfileRecords } from '../ProfileRecords';
import { RootLayout } from '../../layouts/RootLayout';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '../../mocks/server';

/*
 * Phase 4 task 18 checkpoint — axe a11y self-check.
 *
 * Why: spec tasks.md task 18 requires `pnpm --filter @sikao/web test:a11y`
 *      to land before Phase 5 entry. We host the a11y suite here under
 *      vitest (jsdom + axe-core) instead of pulling in vitest-axe (the
 *      package was listed in package.json devDeps but the install slot is
 *      empty in this monorepo). axe-core itself is already installed and
 *      its ESM entry runs fine inside jsdom.
 *
 *      Each view is rendered in isolation (Home/Practice/Note/Me/Hub/Review)
 *      and the rendered HTML fragment is fed to axe.run() with the wcag2a /
 *      wcag2aa / wcag21a / wcag21aa rule set. Color-contrast is OFF because
 *      jsdom doesn't compute styles — that gate is owned by Phase 7
 *      playwright visual regression (task 23.2b focus visibility) where
 *      a real browser engine resolves CSS.
 *
 *      RootLayout is tested via the in-memory router so the live nav state
 *      is rendered with the SIK-121 4-tab nav + RailMe slot. The 5-tab
 *      variant was retired in W1 (see
 *      docs/plan/sik-rail-v5-visual-contract.md §1–§2 + Acceptance H01).
 */

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    // jsdom does not compute styles, so color-contrast checks would all
    // false-fail. Defer to Phase 7 playwright visual regression for the
    // contrast pass.
    'color-contrast': { enabled: false },
    // landmark-one-main is a page-level rule; isolated view fragments
    // don't have the AppShell <main> wrapper, so suppress it here.
    // RootLayout test below covers the wrapper case.
    'landmark-one-main': { enabled: false },
    // region rule similarly expects every node to live inside a landmark;
    // skeleton fragments are intentionally rendered without their shell.
    'region': { enabled: false },
  },
};

async function runAxe(node: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(node, AXE_OPTIONS);
}

function renderInRouter(view: ReactElement, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>{view}</MemoryRouter>,
  );
}

function renderWithQueryRouter(routes: Parameters<typeof createMemoryRouter>[0], initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(routes, { initialEntries });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Phase 4 a11y baseline (task 18 checkpoint)', () => {
  it('Home view passes axe wcag2aa', async () => {
    const { container } = renderWithProviders(<Home />, { initialEntries: ['/'] });
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('Practice view passes axe wcag2aa', async () => {
    const { container } = renderWithProviders(<Practice />, { initialEntries: ['/practice'] });
    await screen.findByText('Section A · 历史记录 / stats / trend');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('AiQuestionsGenerating view passes axe wcag2aa', async () => {
    const { container } = renderWithQueryRouter(
      [
        { path: '/practice/ai-questions/generating', element: <AiQuestionsGenerating /> },
        { path: '/practice/sessions/:sessionId', element: <div>session route</div> },
      ],
      ['/practice/ai-questions/generating?type=xingce&count=10&yearRange=recent_3&difficultyMin=0&difficultyMax=1&practiceMode=full_set&excludeDone=true&onlyWrong=false'],
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('Note view passes axe wcag2aa', async () => {
    const { container } = renderInRouter(<Note />, '/note');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('Me view passes axe wcag2aa', async () => {
    const { container } = renderInRouter(<Me />, '/me');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('PracticePreferences view passes axe wcag2aa', async () => {
    const { container } = renderWithProviders(<PracticePreferences />, {
      initialEntries: ['/profile/practice-preferences'],
    });
    await screen.findByRole('button', { name: '保存设置' });
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('PracticeSession view passes axe wcag2aa', async () => {
    const { container } = renderWithQueryRouter(
      [{ path: '/practice/sessions/:sessionId', element: <PracticeSession /> }],
      ['/practice/sessions/6001'],
    );
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('SessionResult view passes axe wcag2aa', async () => {
    const { container } = renderWithQueryRouter(
      [{ path: '/practice/sessions/:sessionId/result', element: <SessionResult /> }],
      ['/practice/sessions/6001/result'],
    );
    await screen.findByTestId('session-result-view');
    await screen.findByText('Summary');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('EssayGradingResult view passes axe wcag2aa', async () => {
    server.use(
      http.get('/api/v2/practice/sessions/:sessionId', ({ params }) =>
        HttpResponse.json({
          actions: [{ key: 'continue', label: 'Continue session', href: `/practice/sessions/${params.sessionId}`, enabled: true }],
          id: Number(params.sessionId),
          track: 'essay',
          entryKind: 'paper',
          status: 'submitted',
          essaySubmissionId: 9101,
          items: [],
          startedAt: '2026-05-24T08:00:00Z',
          practiceMode: 'full_set',
          sourceMode: 'paper',
          configSnapshot: {},
          pausedCount: 0,
          totalActiveSeconds: 0,
          pausedTotalSeconds: 0,
          examMode: false,
        }),
      ),
      http.get('/api/v2/practice/essay/submissions/:submissionId/grading-status', () =>
        HttpResponse.json({
          submissionId: 9101,
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
    const { container } = renderWithQueryRouter(
      [{ path: '/practice/sessions/:sessionId/grading', element: <EssayGradingResult /> }],
      ['/practice/sessions/6001/grading'],
    );
    await screen.findByTestId('essay-grading-view');
    await screen.findByText('Report');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('Question Hub view passes axe wcag2aa', async () => {
    const { container } = renderInRouter(<QuestionHub />, '/question-hub');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('Review view passes axe wcag2aa', async () => {
    const { container } = renderInRouter(<Review />, '/review');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('ProfileRecords view passes axe wcag2aa (SIK-93 timeline rewrite)', async () => {
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({
          items: [
            {
              id: 'practice-6001',
              kind: 'xingce_practice',
              title: 'Xingce practice',
              occurredAt: '2026-05-23T10:42:00Z',
              score: '76.5',
              status: 'completed',
              href: '/practice/sessions/6001/result',
            },
            {
              id: 'essay-submission-9',
              kind: 'essay_submission',
              title: 'Essay submission',
              occurredAt: '2026-05-22T21:08:00Z',
              score: '38',
              status: 'completed',
              href: '/practice/essay/submissions/9/result',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 2,
        }),
      ),
    );
    const { container } = renderWithProviders(<ProfileRecords />, {
      initialEntries: ['/profile/records'],
    });
    await screen.findByTestId('profile-records-row-practice-6001');
    const results = await runAxe(container);
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  it('RootLayout (full SaaS shell) passes axe wcag2aa', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <RootLayout />,
          children: [
            { index: true, element: <Home /> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );
    const { container } = render(<RouterProvider router={router} />);
    const results = await axe.run(container, {
      ...AXE_OPTIONS,
      rules: {
        ...AXE_OPTIONS.rules,
        // RootLayout DOES wrap in <main> via Workspace; turn the rule
        // back on so the wrapper is verified.
        'landmark-one-main': { enabled: true },
      },
    });
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

function formatViolations(violations: axe.Result[]): string {
  if (violations.length === 0) return '';
  return violations
    .map((v) => `[${v.id}] ${v.help}\n  ${v.nodes.map((n) => n.html.slice(0, 120)).join('\n  ')}`)
    .join('\n\n');
}
