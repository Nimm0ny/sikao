import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultipleChoiceRenderer from '../MultipleChoiceRenderer';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQ(opts = ['A', 'B', 'C', 'D']): QuestionDetailV2 {
  return {
    questionId: 1001,
    questionNo: 1,
    sectionId: 'sec-1',
    questionKind: 'multiple_choice',
    rendererKey: 'multiple_choice',
    content: {
      stem: '<p>选择正确选项</p>',
      options: opts.map((k, i) => ({ key: k, text: `选项 ${k}`, displayOrder: i })),
    },
  } as unknown as QuestionDetailV2;
}

describe('MultipleChoiceRenderer', () => {
  it('renders stem + multi-select hint + all options', () => {
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('multiple-choice-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('multiple-choice-hint')).toHaveTextContent(/多选题/);
    for (const k of ['A', 'B', 'C', 'D']) expect(screen.getByText(`选项 ${k}`)).toBeInTheDocument();
  });

  it('clicking an unselected option fires onAnswerChange with that key added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={[]} onAnswerChange={onChange} />);
    await user.click(screen.getByText('选项 B'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['B']);
  });

  it('clicking a selected option fires onAnswerChange with that key removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={['B', 'D']} onAnswerChange={onChange} />);
    await user.click(screen.getByText('选项 B'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['D']);
  });

  it('emits keys sorted by option display order, not click order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={['C']} onAnswerChange={onChange} />);
    // user clicks A after C is already selected — expected output [A, C] (display order)
    await user.click(screen.getByText('选项 A'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['A', 'C']);
  });

  it('deselecting last option emits empty array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={['B']} onAnswerChange={onChange} />);
    await user.click(screen.getByText('选项 B'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('does not mutate parent selectedAnswer array (Set isolation)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const parentArr: readonly string[] = ['B'];
    render(<MultipleChoiceRenderer question={makeQ()} selectedAnswer={parentArr} onAnswerChange={onChange} />);
    await user.click(screen.getByText('选项 D'));
    expect(parentArr).toEqual(['B']);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['B', 'D']);
  });

  it('handles a 5-option ballot (e.g. 行测多选有时 5 项)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultipleChoiceRenderer question={makeQ(['A','B','C','D','E'])} selectedAnswer={[]} onAnswerChange={onChange} />);
    await user.click(screen.getByText('选项 E'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['E']);
  });
});
