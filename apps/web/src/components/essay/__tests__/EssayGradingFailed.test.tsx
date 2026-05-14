import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EssayGradingFailed } from '../EssayGradingFailed';

describe('EssayGradingFailed', () => {
  it('renders product failure copy + retry button without raw technical code', () => {
    render(
      <EssayGradingFailed
        failureReason="LLM_PARSE_FAILED: regex extract fallback raised"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('批改失败')).toBeInTheDocument();
    expect(screen.getByText('本次批改没有完成, 可重新提交一次.')).toBeInTheDocument();
    expect(screen.queryByText(/LLM_PARSE_FAILED|fallback/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-failed-retry')).toBeInTheDocument();
  });

  it('does not render a reason block when failureReason is null', () => {
    render(<EssayGradingFailed failureReason={null} onRetry={vi.fn()} />);
    expect(
      screen.queryByTestId('essay-grading-failed-reason'),
    ).not.toBeInTheDocument();
  });

  it('does not render a reason block when failureReason is empty string', () => {
    render(<EssayGradingFailed failureReason="" onRetry={vi.fn()} />);
    expect(
      screen.queryByTestId('essay-grading-failed-reason'),
    ).not.toBeInTheDocument();
  });

  it('retry button calls onRetry on click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<EssayGradingFailed failureReason={null} onRetry={onRetry} />);
    await user.click(screen.getByTestId('essay-grading-failed-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retry button disabled + shows submitting copy when isRetrying', () => {
    render(
      <EssayGradingFailed
        failureReason="X"
        onRetry={vi.fn()}
        isRetrying={true}
      />,
    );
    const btn = screen.getByTestId('essay-grading-failed-retry');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('提交中…');
  });

  it('uses error tone (EmptyState role=alert + danger border)', () => {
    render(<EssayGradingFailed failureReason="X" onRetry={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-tone', 'error');
    expect(alert).toHaveClass('border-err');
  });
});
