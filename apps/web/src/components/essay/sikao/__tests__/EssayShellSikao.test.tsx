import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { EssayShellSikao } from '../EssayShellSikao';
import { useExamSession } from '@sikao/domain/shenlun/useExamSession';
import type { Highlight } from '@sikao/domain/shenlun/types';
import { __resetClipIdCounter } from '../lib/clipId';
import type { Paper } from '@sikao/domain/shenlun/types';

const mockPaper: Paper = {
  id: 'p1',
  code: 'p1-code',
  name: '测试套卷',
  questions: [
    {
      no: '第一题',
      kind: '概括',
      title: '概括问题',
      body: '请概括 X。',
      minWords: 100,
      maxWords: 200,
      durationSec: 600,
      requirements: ['条理清晰'],
      refMaterials: ['m1'],
      backendId: 1001,
      fullScore: 10,
    },
    {
      no: '第二题',
      kind: '对策',
      title: '提出对策',
      body: '请提出对策。',
      minWords: 200,
      maxWords: 300,
      durationSec: 1200,
      requirements: ['可行'],
      refMaterials: ['m2'],
      backendId: 1002,
      fullScore: 15,
    },
  ],
  materials: [
    { id: 'm1', title: '资料一', subtitle: '', body: '材料一正文。' },
    { id: 'm2', title: '资料二', subtitle: '', body: '材料二正文。' },
  ],
};

beforeEach(() => {
  __resetClipIdCounter();
  act(() => {
    useExamSession.getState().hydrate(mockPaper);
    useExamSession.getState().start(); // skip prestart modal
  });
});

describe('EssayShellSikao integration', () => {
  it('renders Topbar + EssayGrid + MaterialPanel + AnswerSheetPanel + question strip', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.getByTestId('essay-topbar')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grid')).toBeInTheDocument();
    expect(screen.getByTestId('essay-material-panel')).toBeInTheDocument();
    expect(screen.getByTestId('essay-answer-panel')).toBeInTheDocument();
    expect(screen.getByTestId('essay-mm-strip-r')).toBeInTheDocument();
  });

  it('renders legacy highlight snapshots and answer input writes to the active question', () => {
    act(() => {
      useExamSession.setState({
        highlights: { m1: [{ start: 0, end: 5 }] satisfies Highlight[] },
      });
    });

    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);

    const clip = screen.getByTestId('essay-material-clip-m1-0');
    expect(clip).toHaveAttribute('data-kind', 'highlight');
    fireEvent.change(screen.getByTestId('essay-answer-sheet-input'), {
      target: { value: '第一题答案' },
    });
    expect(useExamSession.getState().textsByQ[0]).toBe('第一题答案');
  });

  it('switch question via MmStrip Q tab', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByLabelText('第 2 题'));
    expect(useExamSession.getState().currentQ).toBe(1);
    // Editor stem updates to the new question
    expect(screen.getByText('提出对策')).toBeInTheDocument();
  });

  it('switch material via MaterialPanel tabs', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByTestId('essay-material-tab-m2'));
    expect(useExamSession.getState().matIdx).toBe(1);
    expect(screen.getByText('资料二')).toBeInTheDocument();
  });

  it('topbar submit opens SubmitDialog', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    fireEvent.click(screen.getByTestId('essay-topbar-submit'));
    // SubmitDialog renders an aria-modal
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('topbar pause toggles phase', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(useExamSession.getState().phase).toBe('running');
    fireEvent.click(screen.getByTestId('essay-topbar-pause'));
    expect(useExamSession.getState().phase).toBe('paused');
    fireEvent.click(screen.getByTestId('essay-topbar-pause'));
    expect(useExamSession.getState().phase).toBe('running');
  });

  it('topbar renders prototype controls and opens draft modal', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.getByTestId('essay-topbar-exit')).toBeInTheDocument();
    expect(screen.getByTestId('essay-topbar-timer')).toHaveTextContent('00:30:00');
    expect(screen.getByTestId('essay-topbar-font-size')).toBeInTheDocument();
    expect(screen.getByTestId('essay-topbar-draft')).toBeInTheDocument();
    expect(screen.getByTestId('essay-topbar-mark')).toBeInTheDocument();
    expect(screen.getByTestId('essay-topbar-help')).toBeInTheDocument();
    expect(screen.getByTestId('essay-topbar-fullscreen')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('essay-topbar-draft'));
    expect(screen.getByTestId('essay-draft-paper-modal')).toBeInTheDocument();
  });

  it('topbar uses real paper metadata instead of prototype fallback labels', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);

    expect(screen.getByText('测试套卷')).toBeInTheDocument();
    expect(screen.queryByText('2026')).not.toBeInTheDocument();
    expect(screen.queryByText('国考')).not.toBeInTheDocument();
    expect(screen.queryByText('副省')).not.toBeInTheDocument();
  });

  it('topbar font-size control cycles the answer grid size', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(useExamSession.getState().gridFontSize).toBe(18);
    fireEvent.click(screen.getByTestId('essay-topbar-font-size'));
    expect(useExamSession.getState().gridFontSize).toBe(20);
  });

  it('topbar submit is disabled outside running and paused phases', () => {
    act(() => useExamSession.setState({ phase: 'submitted' }));
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.getByTestId('essay-topbar-submit')).toBeDisabled();
  });

  it('topbar mark toggles the active question marker', () => {
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);

    const btn = screen.getByTestId('essay-topbar-mark');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides MmStrip in single-q mode with a single q+single m', () => {
    act(() => {
      useExamSession.getState().hydrate({
        ...mockPaper,
        questions: [mockPaper.questions[0]],
        materials: [mockPaper.materials[0]],
      });
      useExamSession.getState().start();
    });
    render(<EssayShellSikao onSubmit={vi.fn()} mode="multi" />);
    expect(screen.queryByTestId('essay-mm-strip-l')).not.toBeInTheDocument();
    expect(screen.queryByTestId('essay-mm-strip-r')).not.toBeInTheDocument();
  });
});
