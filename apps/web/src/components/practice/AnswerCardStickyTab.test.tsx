import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerCardStickyTab } from './AnswerCardStickyTab';

describe('AnswerCardStickyTab', () => {
  it('renders progress text and aria-label', () => {
    render(<AnswerCardStickyTab answeredCount={5} totalCount={130} onClick={() => undefined} />);
    const tab = screen.getByTestId('answer-card-sticky-tab');
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute('aria-label', '展开答题卡, 已答 5 / 130');
    expect(screen.getByText('5/130')).toBeInTheDocument();
  });

  it('hidden=true does not render', () => {
    render(<AnswerCardStickyTab answeredCount={0} totalCount={10} hidden onClick={() => undefined} />);
    expect(screen.queryByTestId('answer-card-sticky-tab')).toBeNull();
  });

  it('click fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<AnswerCardStickyTab answeredCount={2} totalCount={10} onClick={onClick} />);
    await user.click(screen.getByTestId('answer-card-sticky-tab'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
