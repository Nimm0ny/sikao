import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerCardDrawerHeader } from './AnswerCardDrawerHeader';

describe('AnswerCardDrawerHeader', () => {
  it('renders title + answered/total count (close button is on panel itself)', () => {
    render(<AnswerCardDrawerHeader answeredCount={3} totalCount={10} />);
    expect(screen.getByText('答题卡')).toBeInTheDocument();
    const progress = screen.getByTestId('answer-card-panel-progress');
    expect(progress).toHaveTextContent('已答 3');
    expect(progress).toHaveTextContent('/ 总数 10');
    // Wave D — close button moved to AnswerCardPanel (panel-close testid).
    // The header no longer has its own close button.
    expect(screen.queryByTestId('drawer-close')).toBeNull();
  });

  // Wave 4 Phase 2A: progress bar fill width = answered/total %.
  it('renders progress bar with fill width matching answered/total ratio', () => {
    render(<AnswerCardDrawerHeader answeredCount={22} totalCount={35} />);
    const fill = screen.getByTestId('answer-card-progress-fill');
    // 22/35 ≈ 62.857... → rounded 63.
    expect(fill.style.width).toBe('63%');
    const bar = screen.getByTestId('answer-card-progress-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '22');
    expect(bar).toHaveAttribute('aria-valuemax', '35');
  });

  it('progress bar handles 0 total gracefully (no NaN)', () => {
    render(<AnswerCardDrawerHeader answeredCount={0} totalCount={0} />);
    const fill = screen.getByTestId('answer-card-progress-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('renders 4 legend dots (未答 / 已答 / 已标记 / 当前)', () => {
    render(<AnswerCardDrawerHeader answeredCount={3} totalCount={10} />);
    const legend = screen.getByTestId('answer-card-legend');
    expect(legend).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-legend-pending')).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-legend-done')).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-legend-marked')).toBeInTheDocument();
    expect(screen.getByTestId('answer-card-legend-current')).toBeInTheDocument();
    // "已答" 同时出现在 progress + legend; 用 legend ul scope 防 multi-match.
    expect(legend).toHaveTextContent('未答');
    expect(legend).toHaveTextContent('已答');
    expect(legend).toHaveTextContent('已标记');
    expect(legend).toHaveTextContent('当前');
  });

  it('legend dots use token colors (rule-strong / ink / exam-accent)', () => {
    render(<AnswerCardDrawerHeader answeredCount={3} totalCount={10} />);
    expect(screen.getByTestId('answer-card-legend-pending').className).toContain(
      'border-line-3',
    );
    expect(screen.getByTestId('answer-card-legend-done').className).toContain(
      'bg-ink',
    );
    expect(screen.getByTestId('answer-card-legend-marked').className).toContain(
      'border-exam-accent',
    );
    expect(screen.getByTestId('answer-card-legend-current').className).toContain(
      'bg-exam-accent',
    );
  });
});
