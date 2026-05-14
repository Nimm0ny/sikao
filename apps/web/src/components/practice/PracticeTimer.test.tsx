import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PracticeTimer } from './PracticeTimer';

// PracticeTimer is a controlled dumb component. The single source of truth
// for elapsed seconds lives in the smart container (PracticeShell), so the
// header timer and the drawer footer can never disagree.

describe('PracticeTimer (controlled)', () => {
  it('exam mode: display = duration - elapsedSeconds', () => {
    render(<PracticeTimer durationSeconds={300} mode="exam" elapsedSeconds={120} />);
    expect(screen.getByTestId('practice-timer')).toHaveTextContent('3:00');
  });

  it('practice mode: display = elapsedSeconds (durationSeconds ignored)', () => {
    render(<PracticeTimer durationSeconds={0} mode="practice" elapsedSeconds={65} />);
    expect(screen.getByTestId('practice-timer')).toHaveTextContent('1:05');
  });

  it('rerender with new elapsedSeconds reflects immediately (no internal tick)', () => {
    const { rerender } = render(
      <PracticeTimer durationSeconds={300} mode="exam" elapsedSeconds={0} />,
    );
    expect(screen.getByTestId('practice-timer')).toHaveTextContent('5:00');
    rerender(<PracticeTimer durationSeconds={300} mode="exam" elapsedSeconds={120} />);
    expect(screen.getByTestId('practice-timer')).toHaveTextContent('3:00');
  });

  it('exam critical: <= 5min remaining → data-state critical', () => {
    render(<PracticeTimer durationSeconds={300} mode="exam" elapsedSeconds={1} />);
    expect(screen.getByTestId('practice-timer')).toHaveAttribute('data-state', 'critical');
  });

  it('exam expired: remaining=0 → onTimeout fires once + data-state expired', () => {
    const onTimeout = vi.fn();
    const { rerender } = render(
      <PracticeTimer
        durationSeconds={300}
        mode="exam"
        elapsedSeconds={299}
        onTimeout={onTimeout}
      />,
    );
    expect(onTimeout).not.toHaveBeenCalled();

    rerender(
      <PracticeTimer
        durationSeconds={300}
        mode="exam"
        elapsedSeconds={300}
        onTimeout={onTimeout}
      />,
    );
    expect(onTimeout).toHaveBeenCalledTimes(1);

    // Stays expired on subsequent renders, never re-fires.
    rerender(
      <PracticeTimer
        durationSeconds={300}
        mode="exam"
        elapsedSeconds={400}
        onTimeout={onTimeout}
      />,
    );
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('practice-timer')).toHaveAttribute('data-state', 'expired');
    expect(screen.getByTestId('practice-timer')).toHaveTextContent('时间到');
  });

  it('practice mode: never fires onTimeout regardless of elapsedSeconds', () => {
    const onTimeout = vi.fn();
    render(
      <PracticeTimer
        durationSeconds={0}
        mode="practice"
        elapsedSeconds={9999}
        onTimeout={onTimeout}
      />,
    );
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
