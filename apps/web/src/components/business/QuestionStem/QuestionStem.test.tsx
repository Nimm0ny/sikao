import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionStem } from './QuestionStem';

describe('QuestionStem', () => {
  it('renders all 4 fontSize buckets via data-font-size', () => {
    for (const fs of [14, 15, 17, 19] as const) {
      const { unmount, getByTestId } = render(
        <QuestionStem number={1} content={<p>题干内容</p>} fontSize={fs} />,
      );
      expect(getByTestId('question-stem').dataset.fontSize).toBe(String(fs));
      unmount();
    }
  });

  it('renders type label and difficulty badge in the meta header', () => {
    render(
      <QuestionStem
        number={42}
        type="单选"
        difficulty="hard"
        content={<p>题目</p>}
      />,
    );
    expect(screen.getByTestId('question-stem').textContent).toContain('42');
    expect(screen.getByTestId('question-stem').textContent).toContain('单选');
    expect(screen.getByTestId('question-stem').textContent).toContain('困难');
  });

  it('flags data-selectable when enableSelection is true', () => {
    render(
      <QuestionStem
        number={1}
        content={<p>可选词标注</p>}
        enableSelection
      />,
    );
    expect(screen.getByTestId('question-stem').dataset.selectable).toBe(
      'true',
    );
  });

  it('renders marks placeholder list when marks are provided', () => {
    render(
      <QuestionStem
        number={1}
        content={<p>富文本</p>}
        marks={[
          { start: 0, end: 4, color: 'yellow' },
          { start: 10, end: 12, color: 'pink' },
        ]}
      />,
    );
    const list = screen.getByTestId('question-stem-marks');
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });

  it('omits marks list entirely when no marks given', () => {
    render(<QuestionStem number={1} content={<p>无标注</p>} />);
    expect(screen.queryByTestId('question-stem-marks')).toBeNull();
  });
});
