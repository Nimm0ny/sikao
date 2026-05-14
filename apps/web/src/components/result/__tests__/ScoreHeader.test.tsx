import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreHeader } from '../ScoreHeader';

describe('ScoreHeader', () => {
  it('renders score with .toFixed(1) and headline', () => {
    render(<ScoreHeader score={82.4} headline="稳定段中游" />);
    expect(screen.getByTestId('score-header-score').textContent).toBe('82.4');
    expect(screen.getByTestId('score-header-headline').textContent).toBe('稳定段中游');
  });

  it('renders default scoreLabel when not provided', () => {
    render(<ScoreHeader score={70} headline="A" />);
    expect(screen.getByTestId('score-header-label').textContent).toMatch(/SCORE/);
  });

  it('renders custom scoreLabel', () => {
    render(<ScoreHeader score={70} headline="A" scoreLabel="得分" />);
    expect(screen.getByTestId('score-header-label').textContent).toBe('得分');
  });

  it('omits maxScore suffix when not provided', () => {
    render(<ScoreHeader score={70} headline="A" />);
    expect(screen.queryByTestId('score-header-max')).toBeNull();
  });

  it('renders maxScore suffix when provided', () => {
    render(<ScoreHeader score={70} headline="A" maxScore={100} />);
    expect(screen.getByTestId('score-header-max').textContent).toMatch(/100/);
  });

  it('omits subtitle when not provided', () => {
    render(<ScoreHeader score={70} headline="A" />);
    expect(screen.queryByTestId('score-header-subtitle')).toBeNull();
  });

  it('renders subtitle when provided', () => {
    render(<ScoreHeader score={70} headline="A" subtitle="比上周 +3 分" />);
    expect(screen.getByTestId('score-header-subtitle').textContent).toBe('比上周 +3 分');
  });

  it('omits meta slot when not provided', () => {
    render(<ScoreHeader score={70} headline="A" />);
    expect(screen.queryByTestId('score-header-meta')).toBeNull();
  });

  it('renders meta slot ReactNode when provided', () => {
    render(
      <ScoreHeader
        score={70}
        headline="A"
        meta={<span data-testid="custom-meta">用时 90 分钟</span>}
      />,
    );
    expect(screen.getByTestId('score-header-meta')).toBeInTheDocument();
    expect(screen.getByTestId('custom-meta').textContent).toBe('用时 90 分钟');
  });

  it('renders headerActions slot when provided', () => {
    render(
      <ScoreHeader
        score={70}
        headline="A"
        headerActions={<button data-testid="export-btn">导出</button>}
      />,
    );
    expect(screen.getByTestId('score-header-actions')).toBeInTheDocument();
    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
  });

  it('respects testIdPrefix', () => {
    render(<ScoreHeader score={70} headline="A" testIdPrefix="essay-grade" />);
    expect(screen.getByTestId('essay-grade')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grade-score')).toBeInTheDocument();
    expect(screen.getByTestId('essay-grade-headline')).toBeInTheDocument();
  });

  it('handles non-finite score gracefully (Fail-Fast adjacent: format only)', () => {
    render(<ScoreHeader score={NaN} headline="A" />);
    // NaN.toFixed(1) === 'NaN'; we coerce non-finite to '0.0' so caller upstream
    // sees a deterministic display. caller is still expected to upstream-validate.
    expect(screen.getByTestId('score-header-score').textContent).toBe('0.0');
  });
});
