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

const intersectionObservers: StubIntersectionObserver[] = [];

class StubIntersectionObserver {
  readonly callback: IntersectionObserverCallback;
  readonly observed = new Set<Element>();
  observe = vi.fn((target: Element) => {
    this.observed.add(target);
  });
  unobserve = vi.fn((target: Element) => {
    this.observed.delete(target);
  });
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    intersectionObservers.push(this);
  }
  emit(entries: ReadonlyArray<{ readonly target: Element; readonly isIntersecting: boolean }>) {
    const records = entries.map((entry) => ({
      target: entry.target,
      isIntersecting: entry.isIntersecting,
    })) as IntersectionObserverEntry[];
    this.callback(records, this as unknown as IntersectionObserver);
  }
}

describe('PracticeSession (SIKAO Fb core)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    intersectionObservers.length = 0;
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
    expect(screen.getByTestId('fb-layout')).toBeInTheDocument();
    expect(screen.getByTestId('fb-topbar')).toHaveClass('fb-top');
    expect(screen.getByTestId('fb-card-101')).toHaveClass('fb-card');
    expect(screen.getByTestId('fb-floating-answer-drawer')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
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

  it('scrolls to the selected question from floating answer drawer and collapses it', async () => {
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
    await user.click(screen.getByTestId('fb-floating-answer-toggle'));
    expect(screen.getByTestId('fb-floating-answer-body')).toBeInTheDocument();
    await user.click(screen.getByTestId('fb-floating-cell-102'));
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
      expect(screen.getByTestId('fb-floating-answer-drawer')).toHaveAttribute(
        'data-collapsed',
        'true',
      );
    });
  });

  it('updates the current question when a normal question card becomes visible', async () => {
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
    const card102Node = await screen.findByTestId('fb-question-card-node-102');
    const observer = intersectionObservers.at(-1);
    if (observer === undefined) {
      throw new Error('Expected PracticeSession to create a visibility observer.');
    }

    act(() => {
      observer.emit([{ target: card102Node, isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(usePracticeStore.getState().currentVisibleQuestionId).toBe('102');
    });
    expect(screen.getByTestId('fb-card-102')).toHaveAttribute('data-current', 'true');
  });

  it('hides scratch FAB before 5 answers (progressive disclosure)', async () => {
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
    await screen.findByTestId('practice-session-fb');
    expect(screen.queryByTestId('fb-scratch-fab')).not.toBeInTheDocument();
  });

  it('shows scratch FAB after 5 answers (progressive disclosure)', async () => {
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
    expect(await screen.findByTestId('fb-scratch-fab')).toBeInTheDocument();
    expect(screen.getByTestId('fb-scratch-col')).toHaveAttribute('data-show', 'true');
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

  it('expands floating answer drawer from its toggle', async () => {
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
    expect(screen.queryByTestId('fb-floating-answer-body')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('fb-floating-answer-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('fb-floating-answer-body')).toBeInTheDocument(),
    );
  });

  it('keeps complete question navigation inside the floating answer drawer', async () => {
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
    expect(screen.queryByTestId('fb-floating-cell-102')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('fb-floating-answer-toggle'));
    expect(screen.getByTestId('fb-floating-cell-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-floating-cell-102')).toBeInTheDocument();
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
    await user.click(screen.getByTestId('fb-floating-answer-toggle'));
    const toolButtons = [
      screen.getByTestId('fb-floating-answer-toggle'),
      screen.getByTestId('fb-topbar-back'),
      screen.getByTestId('fb-topbar-pause'),
      screen.getByTestId('fb-topbar-settings'),
      screen.getByTestId('fb-action-fav-101'),
      screen.getByTestId('fb-action-mark-101'),
      screen.getByTestId('fb-action-note-101'),
      screen.getByTestId('fb-scratch-fab'),
    ];
    for (const button of toolButtons) {
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute('title');
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button).toHaveTextContent('');
    }
    const submit = screen.getByTestId('fb-topbar-submit');
    expect(submit).toHaveAccessibleName('交卷');
    expect(submit.querySelector('svg')).not.toBeNull();
    expect(submit).toHaveTextContent('交卷');
    expect(submit).not.toHaveAttribute('title');
    await user.hover(screen.getByTestId('fb-floating-answer-toggle'));
    expect(await screen.findByRole('tooltip', { name: '收起答题卡' })).toBeInTheDocument();
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
    expect(card).toHaveClass('border-exam-accent');
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
    const submit = await screen.findByTestId('fb-topbar-submit');
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
    const submit = await screen.findByTestId('fb-topbar-submit');
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
    const submit = await screen.findByTestId('fb-topbar-submit');
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
