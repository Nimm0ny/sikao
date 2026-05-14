import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { ExamShell } from '../ExamShell';
import { useExamSession } from '../hooks/useExamSession';
import { mockPaper } from '../data/essayExamMock';

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
    celebrateQ: -1,
    warnToastQ: -1,
  });
});

function setup(currentQ = 0) {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.getState().setCurrentQ(currentQ);
  useExamSession.setState({ phase: 'running' });
}

describe('TopBar Row 2 (PR4) — question rings + 题干 peek', () => {
  it('renders one progress ring per question', () => {
    setup();
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    for (let i = 0; i < mockPaper.questions.length; i += 1) {
      const ring = screen.getByTestId(`exam-questionring-${i}`);
      expect(ring).toBeInTheDocument();
      expect(ring.querySelector('svg')).not.toBeNull();
      expect(ring).not.toHaveAttribute('title');
    }
  });

  it('expands the active ring with N/M · mm:ss stats', () => {
    setup(2);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const stats = screen.getByTestId('exam-questionring-stats-2');
    expect(stats).toHaveTextContent(`0/${mockPaper.questions[2].minWords}`);
    expect(stats).toHaveTextContent('00:00');
  });

  it('switches currentQ when a ring is clicked', async () => {
    setup(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('exam-questionring-3'));
    expect(useExamSession.getState().currentQ).toBe(3);
  });

  it('toggles the question-peek popover on the toolbar button', async () => {
    setup(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.queryByTestId('exam-question-peek')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('exam-topbar-question-peek-toggle'));
    expect(screen.getByTestId('exam-question-peek')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('exam-topbar-question-peek-toggle'));
    expect(screen.queryByTestId('exam-question-peek')).not.toBeInTheDocument();
  });

  it('renders peek body for the active question after pinning the toggle', async () => {
    setup(2);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('exam-topbar-question-peek-toggle'));
    const peek = screen.getByTestId('exam-question-peek');
    expect(peek).toHaveTextContent(mockPaper.questions[2].title);
    expect(peek).toHaveTextContent(mockPaper.questions[2].body);
    // pinned peek targets the *current* question, so 切到此题 button is suppressed
    expect(screen.queryByTestId('exam-question-peek-switch')).not.toBeInTheDocument();
  });

  it('triggers celebrate state when 字数 first crosses minWords', () => {
    setup(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const target = mockPaper.questions[0].minWords;
    act(() => {
      useExamSession.getState().setText(0, '字'.repeat(target));
    });
    expect(useExamSession.getState().celebrateQ).toBe(0);
  });

  it('double-click on a ring switches currentQ and pins the peek', () => {
    setup(0);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.queryByTestId('exam-question-peek')).not.toBeInTheDocument();
    // fireEvent.doubleClick fires the dblclick event directly; user-event's
    // dblClick simulates two real clicks but jsdom doesn't synthesize a
    // dblclick from them, so React's onDoubleClick never runs.
    fireEvent.doubleClick(screen.getByTestId('exam-questionring-3'));
    expect(useExamSession.getState().currentQ).toBe(3);
    // pinned peek surfaces the active question (index 3) and hides the
    // 切到此题 button since peek === currentQ.
    expect(screen.getByTestId('exam-question-peek')).toBeInTheDocument();
    expect(screen.queryByTestId('exam-question-peek-switch')).not.toBeInTheDocument();
  });

  it('double-click on the active ring toggles the pinned peek off', async () => {
    setup(2);
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    // pin via toolbar so the peek is visible to start with
    fireEvent.click(screen.getByTestId('exam-topbar-question-peek-toggle'));
    expect(screen.getByTestId('exam-question-peek')).toBeInTheDocument();
    // double-click the active ring → toggle pinnedPeek false
    fireEvent.doubleClick(screen.getByTestId('exam-questionring-2'));
    expect(useExamSession.getState().currentQ).toBe(2);
    expect(screen.queryByTestId('exam-question-peek')).not.toBeInTheDocument();
  });
});
