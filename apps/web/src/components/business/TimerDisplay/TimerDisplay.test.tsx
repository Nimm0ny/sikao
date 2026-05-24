import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TimerDisplay } from './TimerDisplay';

describe('TimerDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders HH:MM:SS via Numeric child', () => {
    render(<TimerDisplay remainingMs={3_725_000} />);
    expect(screen.getByTestId('timer-display').textContent).toBe('01:02:05');
  });

  it('flips to warn tone when remaining <= warningThreshold', () => {
    render(<TimerDisplay remainingMs={4 * 60 * 1000} warningThreshold={5 * 60 * 1000} />);
    expect(screen.getByTestId('timer-display').dataset.tone).toBe('warn');
  });

  it('flips to err tone at zero', () => {
    render(<TimerDisplay remainingMs={0} />);
    expect(screen.getByTestId('timer-display').dataset.tone).toBe('err');
  });

  it('emits onTick once per second when not paused', () => {
    const onTick = vi.fn();
    const { rerender } = render(
      <TimerDisplay remainingMs={3000} onTick={onTick} />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenLastCalledWith(2000);
    // Caller drives the display by feeding the new remainingMs back in.
    rerender(<TimerDisplay remainingMs={2000} onTick={onTick} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTick).toHaveBeenLastCalledWith(1000);
    rerender(<TimerDisplay remainingMs={1000} onTick={onTick} />);
    expect(screen.getByTestId('timer-display').textContent).toBe('00:00:01');
  });

  it('does not tick while paused=true', () => {
    const onTick = vi.fn();
    render(<TimerDisplay remainingMs={3000} paused onTick={onTick} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTick).not.toHaveBeenCalled();
    expect(screen.getByTestId('timer-display').textContent).toBe('00:00:03');
  });
});
