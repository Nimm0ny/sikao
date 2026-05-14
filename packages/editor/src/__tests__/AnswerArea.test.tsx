import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { AnswerArea } from '../panels/AnswerArea';
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

function setup(currentQ = 0, phase: 'prestart' | 'running' | 'paused' = 'running') {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.getState().setCurrentQ(currentQ);
  useExamSession.setState({ phase });
}

describe('AnswerArea (PR3)', () => {
  it('renders at least 2 grid pages by default for the 200-char prompt', () => {
    setup(0);
    renderWithProviders(<AnswerArea />);
    // minWords=200 < 450 chars/page, but min floor is 2 pages
    expect(screen.getByTestId('exam-gridpaper-page-0')).toBeInTheDocument();
    expect(screen.getByTestId('exam-gridpaper-page-1')).toBeInTheDocument();
  });

  it('shows 3 pages for the 1000-word essay (ceil(1000 / 450) = 3)', () => {
    setup(4);
    renderWithProviders(<AnswerArea />);
    expect(screen.getByTestId('exam-gridpaper-page-0')).toBeInTheDocument();
    expect(screen.getByTestId('exam-gridpaper-page-1')).toBeInTheDocument();
    expect(screen.getByTestId('exam-gridpaper-page-2')).toBeInTheDocument();
  });

  it('does NOT render the legacy QuestionCard (T-A3 removed it)', () => {
    setup(4);
    renderWithProviders(<AnswerArea />);
    expect(screen.queryByTestId('exam-questioncard-no')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exam-questioncard-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exam-questioncard-refmat-m1')).not.toBeInTheDocument();
  });

  it('shows the word ruler with the active question target', () => {
    setup(0);
    renderWithProviders(<AnswerArea />);
    const ruler = screen.getByTestId('exam-word-ruler');
    expect(ruler).toHaveTextContent(`${mockPaper.questions[0].minWords}`);
    expect(screen.getByTestId('exam-word-ruler-count')).toHaveTextContent('0');
  });

  it('shows max-only word limits as an upper bound', () => {
    useExamSession.getState().hydrate({
      ...mockPaper,
      questions: [
        {
          ...mockPaper.questions[0],
          minWords: undefined,
          maxWords: 300,
          requirements: ['要求全面准确', '不超过 300 字'],
        },
        ...mockPaper.questions.slice(1),
      ],
    });
    useExamSession.setState({ phase: 'running' });

    renderWithProviders(<AnswerArea />);

    const ruler = screen.getByTestId('exam-word-ruler');
    expect(ruler).toHaveTextContent('上限 300 字');
    expect(ruler).not.toHaveTextContent('还差');
  });

  it('updates the ruler count when text changes', () => {
    setup(0);
    renderWithProviders(<AnswerArea />);
    expect(screen.getByTestId('exam-word-ruler-count')).toHaveTextContent('0');
    act(() => {
      useExamSession.getState().setText(0, '甲乙丙丁');
    });
    expect(screen.getByTestId('exam-word-ruler-count')).toHaveTextContent('4');
  });

  it('shows the pager only once content overflows the minimum page count', () => {
    setup(0);
    renderWithProviders(<AnswerArea />);
    // minWords=200 → 2 pages → pager visible
    expect(screen.getByTestId('exam-pager')).toBeInTheDocument();
  });

  it('disables the hidden textarea when phase != running', () => {
    setup(0, 'paused');
    renderWithProviders(<AnswerArea />);
    expect(screen.getByTestId('exam-answerarea-hidden-input')).toBeDisabled();
  });

  it('shows SVG-only font controls and bumps within [14,22]', () => {
    setup(0);
    renderWithProviders(<AnswerArea />);
    expect(screen.getByTestId('exam-answerarea-font-size')).toHaveTextContent('18');
    const fontUp = screen.getByTestId('exam-answerarea-font-up');
    const fontDown = screen.getByTestId('exam-answerarea-font-down');
    expect(fontUp).toHaveAccessibleName('放大答题卡字号');
    expect(fontDown).toHaveAccessibleName('缩小答题卡字号');
    expect(fontUp.querySelector('svg')).not.toBeNull();
    expect(fontDown.querySelector('svg')).not.toBeNull();
    expect(fontUp).toHaveTextContent('');
    expect(fontDown).toHaveTextContent('');
    expect(fontUp).not.toHaveAttribute('title');
    expect(fontDown).not.toHaveAttribute('title');
    fireEvent.click(fontUp);
    expect(useExamSession.getState().gridFontSize).toBe(19);
    fireEvent.click(fontDown);
    fireEvent.click(fontDown);
    expect(useExamSession.getState().gridFontSize).toBe(17);
    // upper clamp at 22
    act(() => {
      useExamSession.setState({ gridFontSize: 22 });
    });
    fireEvent.click(screen.getByTestId('exam-answerarea-font-up'));
    expect(useExamSession.getState().gridFontSize).toBe(22);
    // lower clamp at 14
    act(() => {
      useExamSession.setState({ gridFontSize: 14 });
    });
    fireEvent.click(screen.getByTestId('exam-answerarea-font-down'));
    expect(useExamSession.getState().gridFontSize).toBe(14);
  });

  it('renders the pager page label "第 X / N 页" reflecting viewPage', () => {
    setup(4); // 1000-word essay → 3 pages
    renderWithProviders(<AnswerArea />);
    expect(screen.getByTestId('exam-pager-label')).toHaveTextContent('第 1 / 3 页');
  });
});
