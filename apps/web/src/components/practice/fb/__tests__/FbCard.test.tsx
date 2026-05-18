import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FbCard } from '../FbCard';
import { useHighlightStore } from '@sikao/domain/xingce/useHighlightStore';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQ(id: number, stem: string): QuestionDetailV2 {
  return {
    questionId: id,
    paperRevisionId: '1',
    sectionId: 'sec-1',
    blockId: `block-${id}`,
    questionNo: id,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem,
      options: [
        { key: 'A', text: 'A 选项' },
        { key: 'B', text: 'B 选项' },
      ],
    },
  };
}

describe('FbCard', () => {
  beforeEach(() => {
    useHighlightStore.setState({ marks: {}, undoStack: [] });
  });

  const baseProps = {
    question: makeQ(101, '题干文字'),
    questionDisplayNo: 16,
    sectionTitle: '数量判断',
    isCurrent: false,
    isAnswered: false,
    selectedAnswers: [],
    isFavorited: false,
    isMarked: false,
    hasNote: false,
    onAnswer: vi.fn(),
    onToggleFavorite: vi.fn(),
    onToggleMark: vi.fn(),
    onOpenNote: vi.fn(),
  };

  it('renders compact question number in serif (no Q prefix)', () => {
    render(<FbCard {...baseProps} />);
    const num = screen.getByLabelText('第 16 题');
    expect(num).toBeInTheDocument();
    expect(num.textContent).toBe('16.');
    expect(screen.queryByText('Q16')).not.toBeInTheDocument();
    expect(num.className).toMatch(/font-serif/);
    expect(num.className).toMatch(/text-h3/);
  });

  it('renders section title and stem', () => {
    render(<FbCard {...baseProps} />);
    expect(screen.getByText('数量判断')).toBeInTheDocument();
    expect(screen.getByText('题干文字')).toBeInTheDocument();
  });

  it('isCurrent=true sets data-current + aria-current + compact card grid', () => {
    render(<FbCard {...baseProps} isCurrent />);
    const card = screen.getByTestId('fb-card-101');
    expect(card).toHaveAttribute('data-current');
    expect(card).toHaveAttribute('aria-current', 'true');
    expect(card.className).toContain('md:grid-cols-[32px_minmax(0,1fr)_auto]');
  });

  it('isCurrent=true uses exam-accent (not generic accent)', () => {
    render(<FbCard {...baseProps} isCurrent />);
    const card = screen.getByTestId('fb-card-101');
    expect(card.className).toContain('border-exam-accent');
    const num = screen.getByLabelText('第 16 题');
    expect(num.className).toMatch(/text-exam-accent/);
  });

  it('isAnswered + non-current → opacity-90 (focus dim)', () => {
    render(<FbCard {...baseProps} isAnswered isCurrent={false} />);
    const card = screen.getByTestId('fb-card-101');
    expect(card.className).toContain('opacity-90');
  });

  it('isCurrent overrides isAnswered (focus, no dim)', () => {
    render(<FbCard {...baseProps} isAnswered isCurrent />);
    const card = screen.getByTestId('fb-card-101');
    expect(card.className).not.toContain('opacity-90');
    expect(card.className).toContain('opacity-100');
  });

  it('renders FbActions toolbar with 4 buttons (fav/mark/note/highlight-stub)', () => {
    render(<FbCard {...baseProps} />);
    const toolbar = screen.getByTestId('fb-actions');
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByTestId('fb-action-fav-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-action-mark-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-action-note-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-action-highlight-101')).toBeInTheDocument();
    expect(screen.getByLabelText(/划线/)).toBeDisabled();
  });

  it('dispatches FbTF for true_false question (ternary)', () => {
    const tfQ: QuestionDetailV2 = {
      ...makeQ(202, '该陈述是否正确?'),
      questionKind: 'true_false',
      rendererKey: 'true_false',
      content: { stem: '该陈述是否正确?', options: [] },
    };
    render(<FbCard {...baseProps} question={tfQ} />);
    expect(screen.getByTestId('fb-tf-202')).toBeInTheDocument();
    expect(screen.queryByTestId('fb-opts-202')).not.toBeInTheDocument();
  });

  it('renders FbOpts for single_choice question (ternary fallback)', () => {
    render(<FbCard {...baseProps} />);
    expect(screen.getByTestId('fb-opts-101')).toBeInTheDocument();
    expect(screen.queryByTestId('fb-tf-101')).not.toBeInTheDocument();
  });

  // P5b/2 highlight marks 渲染
  it('P5b/2: stem 内插入 <mark.fb-hl> 当 store 含 mark for this qid', () => {
    useHighlightStore.getState().addMark({
      id: 'm-test-1',
      questionId: '101',
      textStart: 0,
      textLength: 2,
      colorKey: 'y',
      createdAt: Date.now(),
    });
    render(<FbCard {...baseProps} />);
    const stem = screen.getByTestId('fb-stem-101');
    const mark = stem.querySelector('mark.fb-hl');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('data-c')).toBe('y');
    expect(mark?.getAttribute('data-mark-id')).toBe('m-test-1');
    expect(mark?.textContent).toBe('题干');
  });

  it('P5b/2: 不同 qid 的 marks 不影响当前题渲染 (scope by qid)', () => {
    useHighlightStore.getState().addMark({
      id: 'm-other',
      questionId: 'other-qid',
      textStart: 0,
      textLength: 2,
      colorKey: 'g',
      createdAt: Date.now(),
    });
    render(<FbCard {...baseProps} />);
    const stem = screen.getByTestId('fb-stem-101');
    expect(stem.querySelector('mark.fb-hl')).toBeNull();
  });

  // P5b/3 armed mode (pulse)
  it('P5b/3: armed=true 加 .is-armed class', () => {
    render(<FbCard {...baseProps} armed />);
    const card = screen.getByTestId('fb-card-101');
    expect(card.className).toMatch(/is-armed/);
    expect(card.getAttribute('data-armed')).toBe('true');
  });

  it('P5b/3: armed=false 默认无 .is-armed class', () => {
    render(<FbCard {...baseProps} />);
    const card = screen.getByTestId('fb-card-101');
    expect(card.className).not.toMatch(/is-armed/);
  });
});
