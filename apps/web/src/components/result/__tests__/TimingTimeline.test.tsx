import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TimingTimeline, type TimingTimelineSectionLabel } from '../TimingTimeline';
import type { QuestionTiming } from '@sikao/shared-utils';

function makeTiming(qid: string, no: number, elapsedSec: number, paused = false): QuestionTiming {
  return { questionId: qid, questionNo: no, elapsedSec, paused };
}

const SECTIONS: readonly TimingTimelineSectionLabel[] = [
  { title: '言语', fromNo: 1, toNo: 2 },
  { title: '判断', fromNo: 3, toNo: 4 },
];

describe('TimingTimeline', () => {
  it('returns null for empty timings', () => {
    const { container } = render(
      <TimingTimeline
        timings={[]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one segment per non-paused timing', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('1', 1, 60), makeTiming('2', 2, 90), makeTiming('3', 3, 0, true)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-segment-1')).toBeInTheDocument();
    expect(screen.getByTestId('timing-segment-2')).toBeInTheDocument();
    expect(screen.queryByTestId('timing-segment-3')).not.toBeInTheDocument();
  });

  it('classifies wrong segments with bg-err token', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('w', 1, 30)]}
        wrongIds={new Set(['w'])}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-segment-w').className).toContain('bg-err');
  });

  it('classifies unanswered segments with bg-line token', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('u', 1, 30)]}
        wrongIds={new Set()}
        unansweredIds={new Set(['u'])}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-segment-u').className).toContain('bg-line');
  });

  it('classifies correct (default) with bg-ink-1 token', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('c', 1, 30)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-segment-c').className).toContain('bg-ink-1');
  });

  it('shows "暂停 N 次" only when there are paused timings', () => {
    const { rerender } = render(
      <TimingTimeline
        timings={[makeTiming('1', 1, 60)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.queryByTestId('timing-paused-count')).not.toBeInTheDocument();

    rerender(
      <TimingTimeline
        timings={[makeTiming('1', 1, 60), makeTiming('2', 2, 0, true), makeTiming('3', 3, 0, true)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-paused-count')).toHaveTextContent('暂停 2 次');
  });

  it('renders section labels with their question ranges', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('1', 1, 30), makeTiming('2', 2, 60)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={SECTIONS}
      />,
    );
    expect(screen.getByText('言语 1-2')).toBeInTheDocument();
    expect(screen.getByText('判断 3-4')).toBeInTheDocument();
  });

  it('shows total elapsed in the header', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('1', 1, 60), makeTiming('2', 2, 90)]}
        wrongIds={new Set()}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    const card = screen.getByTestId('timing-timeline');
    expect(within(card).getByText(/总 2:30/)).toBeInTheDocument();
  });

  it('segment aria-label is descriptive (no/elapsed/state)', () => {
    render(
      <TimingTimeline
        timings={[makeTiming('w', 42, 252)]}
        wrongIds={new Set(['w'])}
        unansweredIds={new Set()}
        sectionLabels={[]}
      />,
    );
    expect(screen.getByTestId('timing-segment-w')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('第 42 题'),
    );
    expect(screen.getByTestId('timing-segment-w')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('4:12'),
    );
    expect(screen.getByTestId('timing-segment-w')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('错'),
    );
  });
});
