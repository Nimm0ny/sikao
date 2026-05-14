import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FillBlankRenderer from '../FillBlankRenderer';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQ(stem = '<p>1+1=?</p>'): QuestionDetailV2 {
  return {
    questionId: 5001,
    questionNo: 1,
    sectionId: 'sec-1',
    questionKind: 'fill_blank',
    rendererKey: 'fill_blank',
    content: { stem, options: [] },
  } as unknown as QuestionDetailV2;
}

describe('FillBlankRenderer', () => {
  it('renders stem + hint + input', () => {
    render(<FillBlankRenderer question={makeQ()} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('fill-blank-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('fill-blank-hint')).toHaveTextContent(/填空题/);
    expect(screen.getByTestId('fill-blank-input')).toBeInTheDocument();
  });

  it('initial input value reflects selectedAnswer[0]', () => {
    render(<FillBlankRenderer question={makeQ()} selectedAnswer={['100']} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('fill-blank-input')).toHaveValue('100');
  });

  it('typing fires onAnswerChange with [text]', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FillBlankRenderer question={makeQ()} selectedAnswer={[]} onAnswerChange={onChange} />);
    await user.type(screen.getByTestId('fill-blank-input'), '42');
    // user.type 触发逐字符 change — 最终调用应是 ['4'] 然后 ['42']
    expect(onChange).toHaveBeenLastCalledWith(['42']);
  });

  it('clearing input emits empty array (treated as un-answered)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FillBlankRenderer question={makeQ()} selectedAnswer={['100']} onAnswerChange={onChange} />);
    const input = screen.getByTestId('fill-blank-input');
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('whitespace-only input also emits [] (avoids "  " counting as answered)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FillBlankRenderer question={makeQ()} selectedAnswer={[]} onAnswerChange={onChange} />);
    await user.type(screen.getByTestId('fill-blank-input'), '   ');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('re-syncs local state when selectedAnswer prop changes (cross-question nav)', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FillBlankRenderer question={makeQ()} selectedAnswer={['1']} onAnswerChange={onChange} />,
    );
    expect(screen.getByTestId('fill-blank-input')).toHaveValue('1');
    rerender(<FillBlankRenderer question={makeQ()} selectedAnswer={['999']} onAnswerChange={onChange} />);
    expect(screen.getByTestId('fill-blank-input')).toHaveValue('999');
  });
});
