import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionPeek } from '../pieces/QuestionPeek';
import { mockPaper } from '@sikao/test-utils/essayExamMock';

afterEach(cleanup);

describe('QuestionPeek (PR4)', () => {
  const noop = () => {};

  it('shows question metadata + body + requirements', () => {
    const q = mockPaper.questions[1];
    render(
      <QuestionPeek
        question={q}
        isCurrent={false}
        onSwitch={noop}
        onMouseEnter={noop}
        onMouseLeave={noop}
      />,
    );
    expect(screen.getByText(q.no)).toBeInTheDocument();
    expect(screen.getByText(q.kind)).toBeInTheDocument();
    expect(screen.getByText((c) => c.startsWith('· 不少于'))).toHaveTextContent(
      `不少于 ${q.minWords} 字`,
    );
    expect(screen.getByText(`「${q.title}」`)).toBeInTheDocument();
    expect(screen.getByText(q.body)).toBeInTheDocument();
    for (const r of q.requirements) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
  });

  it('shows max-only word limits without a minimum wording', () => {
    const q = {
      ...mockPaper.questions[0],
      minWords: undefined,
      maxWords: 300,
      requirements: ['要求全面准确', '不超过 300 字'],
    };

    render(
      <QuestionPeek
        question={q}
        isCurrent
        onSwitch={noop}
        onMouseEnter={noop}
        onMouseLeave={noop}
      />,
    );

    const peek = screen.getByTestId('exam-question-peek');
    expect(peek).toHaveTextContent('不超过 300 字');
    expect(peek).not.toHaveTextContent('不少于 300 字');
  });

  it('hides 切到此题 button when isCurrent', () => {
    render(
      <QuestionPeek
        question={mockPaper.questions[0]}
        isCurrent
        onSwitch={noop}
        onMouseEnter={noop}
        onMouseLeave={noop}
      />,
    );
    expect(screen.queryByTestId('exam-question-peek-switch')).not.toBeInTheDocument();
  });

  it('fires onSwitch when 切到此题 is clicked', async () => {
    const user = userEvent.setup();
    let switched = false;
    render(
      <QuestionPeek
        question={mockPaper.questions[2]}
        isCurrent={false}
        onSwitch={() => { switched = true; }}
        onMouseEnter={noop}
        onMouseLeave={noop}
      />,
    );
    await user.click(screen.getByTestId('exam-question-peek-switch'));
    expect(switched).toBe(true);
  });
});
