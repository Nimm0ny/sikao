import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbScratchCol } from '../FbScratchCol';
import type { ScratchClip } from '@sikao/domain/answer-session/usePracticeStore';

describe('FbScratchCol', () => {
  const baseProps = {
    clips: [] as readonly ScratchClip[],
    answeredCount: 0,
    currentQuestionLabel: 'Q16 数字推理',
    currentQuestionId: '101',
    onAddClip: vi.fn(),
    onRemoveClip: vi.fn(),
  };

  it('hidden via data-show=false when answeredCount < 5', () => {
    render(<FbScratchCol {...baseProps} answeredCount={3} />);
    const col = screen.getByTestId('fb-scratch-col');
    expect(col).toHaveAttribute('data-show', 'false');
    expect(col).toHaveAttribute('aria-hidden', 'true');
  });

  it('visible via data-show=true when answeredCount >= 5', () => {
    render(<FbScratchCol {...baseProps} answeredCount={5} />);
    const col = screen.getByTestId('fb-scratch-col');
    expect(col).toHaveAttribute('data-show', 'true');
    expect(col).toHaveAttribute('aria-hidden', 'false');
  });

  it('shows empty state when clips is empty', () => {
    render(<FbScratchCol {...baseProps} answeredCount={5} />);
    expect(screen.getByTestId('fb-scratch-empty')).toBeInTheDocument();
  });

  it('renders clips when present', () => {
    const clips: readonly ScratchClip[] = [
      {
        id: 'clip-1',
        qid: '101',
        content: '差为等差',
        sourceLabel: 'Q16',
        createdAt: 0,
      },
    ];
    render(<FbScratchCol {...baseProps} clips={clips} answeredCount={5} />);
    expect(screen.getByTestId('fb-scratch-clip-clip-1')).toBeInTheDocument();
    expect(screen.getByText('差为等差')).toBeInTheDocument();
  });

  it('submit form fires onAddClip with current question context', async () => {
    const onAddClip = vi.fn();
    const user = userEvent.setup();
    render(
      <FbScratchCol
        {...baseProps}
        answeredCount={5}
        onAddClip={onAddClip}
      />,
    );
    const input = screen.getByTestId('fb-scratch-add-input');
    expect(input).toHaveAttribute('id', 'fb-scratch-add-input');
    expect(input).toHaveAttribute('name', 'scratchClip');
    await user.type(input, '差: 4, 6, 8, 10');
    await user.click(screen.getByTestId('fb-scratch-add-submit'));
    expect(onAddClip).toHaveBeenCalledWith({
      qid: '101',
      content: '差: 4, 6, 8, 10',
      sourceLabel: 'Q16 数字推理',
    });
  });

  it('submit disabled when content empty', () => {
    render(<FbScratchCol {...baseProps} answeredCount={5} />);
    expect(screen.getByTestId('fb-scratch-add-submit')).toBeDisabled();
  });
});
