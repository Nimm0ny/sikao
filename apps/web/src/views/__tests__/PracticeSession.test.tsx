import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import PracticeSession from '../PracticeSession';
import type { PracticeSessionStartV2, QuestionDetailV2 } from '@sikao/api-client/types/api';

// SIKAO Phase 3 (2026-05-09): Xingce practice session core.
//
// The main answer surface renders a continuous list of all questions.

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ sessionId: '42' }),
  };
});

class StubIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  constructor(_cb: IntersectionObserverCallback) {
    void _cb;
  }
}

describe('PracticeSession (SIKAO Fb core)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    usePracticeStore.setState({
      sessionData: null,
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    window.localStorage.removeItem('sikao.practice.viewMode');
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      StubIntersectionObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  it('shows SessionLoading initially when sessionData is null', () => {
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.queryByTestId('session-back-home')).not.toBeInTheDocument();
  });

  it('switches to error EmptyState after 3s timeout', () => {
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByTestId('session-back-home')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
  });

  it('renders the three Fb skeleton segments', async () => {
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(await screen.findByTestId('practice-session-fb')).toBeInTheDocument();
    expect(screen.getByTestId('fb-layout')).toHaveClass('grid-cols-1');
    expect(screen.getByTestId('fb-topbar')).toHaveClass('fb-top');
    expect(screen.getByTestId('fb-card-101')).toHaveClass('fb-card');
    await userEvent.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    expect(screen.getByTestId('fb-dock-panel')).toHaveClass('fb-dock');
  });

  it('renders the first and second questions together in the core answering area', async () => {
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.getByText('第一题题干')).toBeInTheDocument();
    expect(screen.getByText('第二题题干')).toBeInTheDocument();
  });

  it('scrolls to the selected question from dock and closes the dock', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const card102 = await screen.findByTestId('fb-card-102');
    const cardNode102 = await screen.findByTestId('fb-question-card-node-102');
    const scrollIntoView = vi.fn();
    cardNode102.scrollIntoView = scrollIntoView;
    await user.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    expect(screen.getByTestId('fb-dock-panel')).toBeInTheDocument();
    await user.click(screen.getByTestId('fb-dock-cell-102'));
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
    await waitFor(() => {
      expect(card102).toHaveAttribute('data-current', 'true');
    });
    await waitFor(() => {
      expect(screen.getByTestId('fb-dock-panel')).toHaveStyle({
        transform: 'translateX(100%)',
      });
    });
  });

  it('hides scratch col before 5 answers (progressive disclosure)', async () => {
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: { '101': ['A'], '102': ['B'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const scratchCol = await screen.findByTestId('fb-scratch-col');
    expect(scratchCol).toHaveAttribute('data-show', 'false');
    expect(scratchCol).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows scratch col after 5 answers (progressive disclosure)', async () => {
    usePracticeStore.setState({
      sessionData: makeBigSessionData(),
      answers: { '1': ['A'], '2': ['A'], '3': ['A'], '4': ['A'], '5': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const scratchCol = await screen.findByTestId('fb-scratch-col');
    expect(scratchCol).toHaveAttribute('data-show', 'true');
    expect(scratchCol).toHaveAttribute('aria-hidden', 'false');
  });

  it('selecting an option updates store.answers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const card101 = await screen.findByTestId('fb-card-101');
    const optionB = within(card101).getByTestId('fb-opt-B');
    await user.click(optionB);
    await waitFor(() => {
      expect(usePracticeStore.getState().answers['101']).toEqual(['B']);
    });
  });

  it('opens FbDrawer on bottom dock open-drawer button click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.queryByTestId('fb-dock-panel')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    await waitFor(() =>
      expect(screen.getByTestId('fb-dock-panel')).toBeInTheDocument(),
    );
  });

  it('keeps complete question navigation inside the dock', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(['102']),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.queryByTestId('fb-dock-cell-102')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    expect(screen.getByTestId('fb-dock-cell-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-dock-cell-102')).toBeInTheDocument();
  });

  it('uses SVG-only accessible tool buttons without native title attributes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: { '101': ['A'], '102': ['A'], '103': ['A'], '104': ['A'], '105': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    await user.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    const toolButtons = [
      screen.getByTestId('practice-bottom-dock-open-drawer'),
      screen.getByTestId('practice-bottom-dock-submit'),
      screen.getByTestId('practice-bottom-dock-prev'),
      screen.getByTestId('practice-bottom-dock-next'),
      screen.getByTestId('fb-topbar-pause'),
      screen.getByTestId('fb-topbar-settings'),
      screen.getByTestId('fb-reading-exit'),
      screen.getByTestId('fb-action-fav-101'),
      screen.getByTestId('fb-action-mark-101'),
      screen.getByTestId('fb-action-note-101'),
      screen.getByTestId('fb-dock-close'),
      screen.getByTestId('fb-scratch-add-submit'),
    ];
    for (const button of toolButtons) {
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute('title');
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button).toHaveTextContent('');
    }
    await user.type(screen.getByTestId('fb-scratch-add-input'), 'mark this');
    await waitFor(() =>
      expect(screen.getByTestId('fb-scratch-add-submit')).not.toBeDisabled(),
    );
    await user.hover(screen.getByTestId('fb-dock-close'));
    expect(await screen.findByRole('tooltip', { name: '关闭' })).toBeInTheDocument();
    await user.unhover(screen.getByTestId('fb-dock-close'));
    await user.hover(screen.getByTestId('fb-scratch-add-submit'));
    expect(await screen.findByRole('tooltip', { name: '添加便签' })).toBeInTheDocument();
  });

  it('does not render AI, Pro, or LLM copy in the session core', async () => {
    usePracticeStore.setState({
      sessionData: makeBigSessionData(),
      answers: { '1': ['A'], '2': ['A'], '3': ['A'], '4': ['A'], '5': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.queryByText(/AI|Pro|LLM/i)).not.toBeInTheDocument();
  });

  it('opens the mobile scratch bottom sheet from the FAB', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeBigSessionData(),
      answers: { '1': ['A'], '2': ['A'], '3': ['A'], '4': ['A'], '5': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    await user.click(screen.getByTestId('fb-scratch-fab'));
    expect(screen.getByTestId('fb-mobile-scratch-sheet')).toHaveClass(
      'fb-bottom-sheet',
    );
  });

  it('marks the current question with a 2px focus rail', async () => {
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const card = await screen.findByTestId('fb-card-101');
    expect(card).toHaveAttribute('data-current', 'true');
    expect(card).toHaveClass('border-l-2');
  });

  it('submits answers via /complete and navigates to result', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let capturedAnswers: Record<string, string[]> | null = null;
    server.use(
      http.post('/api/v2/practice/sessions/:id/complete', async ({ request }) => {
        const body = (await request.json()) as { answers: Record<string, string[]> };
        capturedAnswers = body.answers;
        return HttpResponse.json({ ok: true });
      }),
    );
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: { '101': ['B'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const submit = await screen.findByTestId('practice-bottom-dock-submit');
    await user.click(submit);
    await waitFor(() => {
      expect(capturedAnswers).toEqual({ '101': ['B'] });
    });
  });

  it('blocks submit when a multi-choice question has fewer than 2 selected (SPEC §11 #6)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let completeCalled = false;
    server.use(
      http.post('/api/v2/practice/sessions/:id/complete', () => {
        completeCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    usePracticeStore.setState({
      sessionData: makeMultiSessionData(),
      // 101 is single (OK), 102 is multi but only 1 selected → 应阻塞.
      answers: { '101': ['A'], '102': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const submit = await screen.findByTestId('practice-bottom-dock-submit');
    await user.click(submit);
    // submit 不应该被调到 BE.
    expect(completeCalled).toBe(false);
  });

  it('allows submit when all multi-choice questions have >=2 selected', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let completeCalled = false;
    server.use(
      http.post('/api/v2/practice/sessions/:id/complete', () => {
        completeCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    usePracticeStore.setState({
      sessionData: makeMultiSessionData(),
      answers: { '101': ['A'], '102': ['A', 'B'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const submit = await screen.findByTestId('practice-bottom-dock-submit');
    await user.click(submit);
    await waitFor(() => {
      expect(completeCalled).toBe(true);
    });
  });

  it('toggles pause via topbar pause button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: {},
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    const pauseBtn = await screen.findByTestId('fb-topbar-pause');
    expect(pauseBtn).toHaveAttribute('aria-label', '暂停');
    await user.click(pauseBtn);
    await waitFor(() =>
      expect(screen.getByTestId('fb-topbar-pause')).toHaveAttribute('aria-label', '继续'),
    );
  });

  it('FAB hidden when answeredCount < 5', () => {
    usePracticeStore.setState({
      sessionData: makeSessionData(),
      answers: { '101': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.queryByTestId('fb-scratch-fab')).not.toBeInTheDocument();
  });

  it('FAB visible when answeredCount >= 5', () => {
    usePracticeStore.setState({
      sessionData: makeBigSessionData(),
      answers: { '1': ['A'], '2': ['A'], '3': ['A'], '4': ['A'], '5': ['A'] },
      flaggedQuestions: new Set(),
      scratchClips: [],
      currentVisibleQuestionId: null,
    });
    renderWithProviders(<PracticeSession />, {
      initialEntries: ['/practice/sessions/42'],
    });
    expect(screen.getByTestId('fb-scratch-fab')).toBeInTheDocument();
  });
});

function makeQuestion(questionId: number, questionNo: number, stem: string): QuestionDetailV2 {
  return {
    questionId,
    paperRevisionId: '1',
    sectionId: 'sec-1',
    blockId: `block-${questionId}`,
    questionNo,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem,
      options: [
        { key: 'A', text: `第${questionNo}题选项 A` },
        { key: 'B', text: `第${questionNo}题选项 B` },
      ],
    },
  };
}

function makeSessionData(): PracticeSessionStartV2 {
  return {
    sessionId: 42,
    paperCode: 'paper-1',
    paperRevisionId: '1',
    paperName: '测试套卷',
    savedAnswers: {},
    sections: [
      {
        sectionId: 'sec-1',
        title: '常识判断',
        blocks: [
          { blockId: 'block-101', type: 'question', question: makeQuestion(101, 1, '第一题题干') },
          { blockId: 'block-102', type: 'question', question: makeQuestion(102, 2, '第二题题干') },
        ],
      },
    ],
  };
}

function makeMultiQuestion(
  questionId: number,
  questionNo: number,
  stem: string,
  questionKind: 'single_choice' | 'multiple_choice',
): QuestionDetailV2 {
  return {
    questionId,
    paperRevisionId: '1',
    sectionId: 'sec-1',
    blockId: `block-${questionId}`,
    questionNo,
    questionKind,
    rendererKey: questionKind,
    content: {
      stem,
      options: [
        { key: 'A', text: `第${questionNo}题选项 A` },
        { key: 'B', text: `第${questionNo}题选项 B` },
        { key: 'C', text: `第${questionNo}题选项 C` },
        { key: 'D', text: `第${questionNo}题选项 D` },
      ],
    },
  };
}

function makeMultiSessionData(): PracticeSessionStartV2 {
  return {
    sessionId: 42,
    paperCode: 'paper-1',
    paperRevisionId: '1',
    paperName: '测试套卷',
    savedAnswers: {},
    sections: [
      {
        sectionId: 'sec-1',
        title: '言语 + 多选',
        blocks: [
          {
            blockId: 'block-101',
            type: 'question',
            question: makeMultiQuestion(101, 1, '单选题题干', 'single_choice'),
          },
          {
            blockId: 'block-102',
            type: 'question',
            question: makeMultiQuestion(102, 2, '多选题题干', 'multiple_choice'),
          },
        ],
      },
    ],
  };
}

function makeBigSessionData(): PracticeSessionStartV2 {
  return {
    sessionId: 42,
    paperCode: 'paper-1',
    paperRevisionId: '1',
    paperName: '测试套卷',
    savedAnswers: {},
    sections: [
      {
        sectionId: 'sec-1',
        title: '言语',
        blocks: [1, 2, 3, 4, 5, 6].map((n) => ({
          blockId: `block-${n}`,
          type: 'question' as const,
          question: makeQuestion(n, n, `第${n}题题干`),
        })),
      },
    ],
  };
}
