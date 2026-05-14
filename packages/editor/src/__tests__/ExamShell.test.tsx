import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { ExamShell } from '../ExamShell';
import { useExamSession } from '../hooks/useExamSession';
import { mockPaper } from '../data/essayExamMock';
import type { Paper } from '@sikao/domain/shenlun/types';

const chromeSmokePaper: Paper = {
  id: 'chrome-smoke-paper',
  code: 'chrome-smoke-paper',
  name: 'Chrome smoke paper',
  questions: [
    {
      no: '第一题',
      kind: '概括',
      title: 'Chrome smoke question',
      body: '请概括材料要点。',
      minWords: 80,
      maxWords: 120,
      durationSec: 10 * 60,
      requirements: ['条理清楚'],
      refMaterials: ['m1'],
      backendId: 9901,
      fullScore: 10,
    },
  ],
  materials: [
    {
      id: 'm1',
      title: '资料一',
      subtitle: '短材料',
      body: '这是一段用于 ExamShell chrome smoke test 的短材料。',
    },
  ],
};

afterEach(() => {
  cleanup();
  useExamSession.setState({
    paper: null,
    phase: 'prestart',
    currentQ: 0,
    textsByQ: [],
    elapsedByQ: [],
    warned5min: {},
    scratch: '',
    highlights: {},
    leftMode: 'normal',
    leftWidthPx: 320,
    matIdx: 0,
    drawerOpen: false,
    overview: false,
    marking: false,
    query: '',
    fontSize: 15,
    gridFontSize: 18,
    rightOpen: true,
    rightWidthPx: 260,
    celebrateQ: -1,
    warnToastQ: -1,
  });
});

function setupHydrated(
  phase: 'prestart' | 'running' | 'paused' = 'running',
  paper: Paper = mockPaper,
) {
  useExamSession.getState().hydrate(paper);
  useExamSession.setState({ phase });
}

describe('ExamShell + TopBar (PR2)', () => {
  it('renders the full chrome (brand, paper name, all panels) once hydrated', () => {
    setupHydrated('running', chromeSmokePaper);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByText('申论模拟考场')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    // paper name shows in TopBar (品牌副标) — QuestionCard removal (T-A3)
    // means it's no longer duplicated on the answer pane.
    expect(screen.getByText(chromeSmokePaper.name)).toBeInTheDocument();
    expect(screen.getByTestId('exam-materials-panel')).toBeInTheDocument();
    expect(screen.getByTestId('exam-scratch-panel')).toBeInTheDocument();
  });

  it('shows the active question word target in the topbar chip', () => {
    setupHydrated();
    useExamSession.getState().setCurrentQ(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const chip = screen.getByTestId('exam-topbar-word-count');
    expect(chip).toHaveTextContent('0');
    expect(chip.parentElement).toHaveTextContent(`/ ${mockPaper.questions[0].minWords}`);
  });

  it('formats the timer as mm:ss using the active question duration', () => {
    setupHydrated();
    useExamSession.getState().setCurrentQ(4);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const expected = `${String(Math.floor(mockPaper.questions[4].durationSec / 60)).padStart(2, '0')}:00`;
    expect(screen.getByTestId('exam-topbar-timer')).toHaveTextContent(expected);
  });

  it('toggles phase when the pause button is clicked', async () => {
    setupHydrated('running');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const pauseBtn = screen.getByTestId('exam-topbar-pause');
    expect(pauseBtn).toHaveAccessibleName('暂停考试');
    expect(pauseBtn.querySelector('svg')).not.toBeNull();
    expect(pauseBtn).not.toHaveAttribute('title');
    fireEvent.click(pauseBtn);
    expect(useExamSession.getState().phase).toBe('paused');
    const resumeBtn = screen.getByTestId('exam-topbar-pause');
    expect(resumeBtn).toHaveAccessibleName('继续考试');
    expect(resumeBtn.querySelector('svg')).not.toBeNull();
    expect(resumeBtn).not.toHaveAttribute('title');
  });

  it('disables pause + submit while in prestart', () => {
    setupHydrated('prestart');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByTestId('exam-topbar-pause')).toBeDisabled();
    expect(screen.getByTestId('exam-topbar-submit')).toBeDisabled();
  });

  it('opens the submit dialog when the topbar submit button is clicked, and fires onSubmit on confirm', () => {
    setupHydrated('running');
    let submitted = false;
    renderWithProviders(<ExamShell onSubmit={() => { submitted = true; }} />);
    fireEvent.click(screen.getByTestId('exam-topbar-submit'));
    expect(screen.getByTestId('exam-submit-dialog')).toBeInTheDocument();
    expect(submitted).toBe(false);
    fireEvent.click(screen.getByTestId('exam-submit-dialog-confirm'));
    expect(submitted).toBe(true);
  });

  it('collapses left pane and exposes an SVG-only expand button', async () => {
    const user = userEvent.setup();
    setupHydrated();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByText('给定资料')).toBeInTheDocument();
    await user.click(screen.getByTestId('exam-shell-left-collapse-btn'));
    expect(useExamSession.getState().leftMode).toBe('collapsed');
    const expand = screen.getByTestId('exam-shell-left-expand-btn');
    expect(expand).toHaveAccessibleName('展开资料栏');
    expect(expand.querySelector('svg')).not.toBeNull();
    expect(expand).toHaveTextContent('');
    expect(expand).not.toHaveAttribute('title');
  });

  it('collapses right pane via an SVG-only expand button', async () => {
    const user = userEvent.setup();
    setupHydrated();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    await user.click(screen.getByTestId('exam-shell-right-collapse-btn'));
    expect(useExamSession.getState().rightOpen).toBe(false);
    const expand = screen.getByTestId('exam-shell-right-expand-btn');
    expect(expand).toHaveAccessibleName('展开草稿栏');
    expect(expand.querySelector('svg')).not.toBeNull();
    expect(expand).toHaveTextContent('');
    expect(expand).not.toHaveAttribute('title');
  });

  it('right resizer drives rightWidthPx within the [200, 480] clamp', () => {
    setupHydrated();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(useExamSession.getState().rightWidthPx).toBe(260);
    act(() => {
      useExamSession.getState().setRightWidthPx(420);
    });
    expect(useExamSession.getState().rightWidthPx).toBe(420);
    act(() => {
      useExamSession.getState().setRightWidthPx(50);
    });
    expect(useExamSession.getState().rightWidthPx).toBe(200);
    act(() => {
      useExamSession.getState().setRightWidthPx(900);
    });
    expect(useExamSession.getState().rightWidthPx).toBe(480);
  });

  it('updates the word counter when the question text changes', () => {
    setupHydrated();
    useExamSession.getState().setCurrentQ(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByTestId('exam-topbar-word-count')).toHaveTextContent('0');
    act(() => {
      useExamSession.getState().setText(0, '在传承中创新');
    });
    expect(screen.getByTestId('exam-topbar-word-count')).toHaveTextContent('6');
  });

  it('⌘S fires onAutosave AND markSaved (manual save, not cosmetic-only)', () => {
    setupHydrated('running');
    let saveCount = 0;
    renderWithProviders(
      <ExamShell onAutosave={() => { saveCount += 1; }} onSubmit={() => {}} />,
    );
    const before = useExamSession.getState().savedAt;
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }),
      );
    });
    expect(saveCount).toBe(1);
    expect(useExamSession.getState().savedAt).toBeGreaterThanOrEqual(before);
  });

  it('⌘F bumps the search-focus pulse so MaterialsPanel can focus the input', () => {
    setupHydrated('running');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const before = useExamSession.getState().searchFocusPulse;
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }),
      );
    });
    expect(useExamSession.getState().searchFocusPulse).toBe(before + 1);
  });

  // PR3 — submitting / submitted phase audit (review P0 #2 + P2 #5).

  it('PR3 submitting 态 → 交卷按钮 disabled + 文案改"提交中"', () => {
    setupHydrated('running');
    useExamSession.getState().startSubmitting();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const submitBtn = screen.getByTestId('exam-topbar-submit');
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('提交中');
  });

  it('PR3 submitted 态 → 交卷按钮 disabled (防重复提交)', () => {
    setupHydrated('running');
    useExamSession.getState().finish();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByTestId('exam-topbar-submit')).toBeDisabled();
  });

  it('PR3 ⌘Enter 在 submitting 态 no-op (不重复打开 SubmitDialog)', () => {
    setupHydrated('running');
    useExamSession.getState().startSubmitting();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.queryByTestId('exam-submit-dialog')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }),
      );
    });
    // submitting 态 ⌘Enter 不应打开 dialog (用户已交卷一次, 防再交一次)
    expect(screen.queryByTestId('exam-submit-dialog')).not.toBeInTheDocument();
  });

  it('PR3 ⌘Space 在 submitting 态 no-op (togglePause guard)', () => {
    setupHydrated('running');
    useExamSession.getState().startSubmitting();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(useExamSession.getState().phase).toBe('submitting');
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', metaKey: true, bubbles: true }),
      );
    });
    expect(useExamSession.getState().phase).toBe('submitting'); // 未漂到 paused
  });

  it('PR3 SubmitDialog 透传 unansweredQuestionNumbers — 第 2/4 题空 → 红底"提交未答题"', async () => {
    const user = userEvent.setup();
    setupHydrated('running');
    // 第 1/3/5 题填了, 2/4 题留空
    act(() => {
      useExamSession.getState().setText(0, '第一题答案');
      useExamSession.getState().setText(2, '第三题答案');
      useExamSession.getState().setText(4, '第五题答案');
    });
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    await user.click(screen.getByTestId('exam-topbar-submit'));
    expect(screen.getByTestId('exam-submit-dialog')).toBeInTheDocument();
    const banner = screen.getByTestId('exam-submit-dialog-unanswered');
    expect(banner).toHaveTextContent('第二题 / 第四题');
    expect(screen.getByTestId('exam-submit-dialog-confirm')).toHaveTextContent(
      '提交未答题',
    );
  });

  it('PR3 全题答了 → SubmitDialog 不显未答 banner, 维持"确认交卷"', async () => {
    const user = userEvent.setup();
    setupHydrated('running');
    act(() => {
      mockPaper.questions.forEach((_, i) => {
        useExamSession.getState().setText(i, `第 ${i + 1} 题答案`);
      });
    });
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    await user.click(screen.getByTestId('exam-topbar-submit'));
    expect(
      screen.queryByTestId('exam-submit-dialog-unanswered'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('exam-submit-dialog-confirm')).toHaveTextContent(
      '确认交卷',
    );
  });
});
