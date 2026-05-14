import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EssayGradingPending } from '../EssayGradingPending';

describe('EssayGradingPending', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title + desc + spinner + elapsed=0s right after mount', () => {
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
    render(<EssayGradingPending startedAt={Date.parse('2026-04-29T12:00:00Z')} />);
    expect(screen.getByTestId('essay-grading-pending')).toBeInTheDocument();
    expect(screen.getByText('批改中')).toBeInTheDocument();
    expect(screen.getByText('正在批改（长篇稍慢）')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-pending-elapsed')).toHaveTextContent('0s');
  });

  it('does not render slow hint before 30s threshold', () => {
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
    const startedAt = Date.now();
    render(<EssayGradingPending startedAt={startedAt} />);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(
      screen.queryByTestId('essay-grading-pending-slow-hint'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('essay-grading-pending-elapsed')).toHaveTextContent('15s');
  });

  it('renders slow hint at 30s threshold', () => {
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
    const startedAt = Date.now();
    render(<EssayGradingPending startedAt={startedAt} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(
      screen.getByTestId('essay-grading-pending-slow-hint'),
    ).toHaveTextContent('批改较慢, 可关闭此页稍后回来');
    expect(screen.getByTestId('essay-grading-pending-elapsed')).toHaveTextContent('30s');
  });

  it('elapsed clamped to 0 when startedAt in future (clock skew safety)', () => {
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
    const futureStart = Date.now() + 5_000;
    render(<EssayGradingPending startedAt={futureStart} />);
    expect(screen.getByTestId('essay-grading-pending-elapsed')).toHaveTextContent('0s');
  });
});
