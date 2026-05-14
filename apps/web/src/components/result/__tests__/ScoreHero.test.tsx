import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScoreHero } from '../ScoreHero';

const BASE = {
  paperName: '2024 国考 行测',
  score: 73.2,
  correctCount: 94,
  questionCount: 130,
};

describe('ScoreHero', () => {
  it('renders score with .toFixed(1) and paper name', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={null} defeatPercentile={null} />);
    expect(screen.getByTestId('hero-score-value').textContent).toBe('73.2');
    expect(screen.getByTestId('result-header').textContent).toContain('2024 国考 行测');
  });

  it('omits delta and bell when both null', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={null} defeatPercentile={null} />);
    expect(screen.queryByTestId('hero-meta-delta')).toBeNull();
    expect(screen.queryByTestId('hero-bell-card')).toBeNull();
  });

  it('delta > 0 renders "+X.X" with success tone', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={4.1} defeatPercentile={null} />);
    const el = screen.getByTestId('hero-meta-delta');
    expect(el.textContent).toMatch(/\+4\.1/);
    expect(el.querySelector('.text-ok')).not.toBeNull();
  });

  it('delta < 0 renders "-X.X" with danger tone', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={-2.5} defeatPercentile={null} />);
    const el = screen.getByTestId('hero-meta-delta');
    expect(el.textContent).toMatch(/-2\.5/);
    expect(el.querySelector('.text-err')).not.toBeNull();
  });

  it('delta === 0 renders "持平" with default tone (no success green)', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={0} defeatPercentile={null} />);
    const el = screen.getByTestId('hero-meta-delta');
    expect(el.textContent).toMatch(/持平/);
    expect(el.querySelector('.text-ok')).toBeNull();
    expect(el.querySelector('.text-err')).toBeNull();
  });

  it('defeatPercentile renders bell card with percentile text', () => {
    render(<ScoreHero {...BASE} prevScoreDelta={null} defeatPercentile={78} />);
    expect(screen.getByTestId('hero-bell-card').textContent).toMatch(/78%/);
  });

  it('formatDuration handles h > 0 (1:54:32)', () => {
    render(
      <ScoreHero
        {...BASE}
        prevScoreDelta={null}
        defeatPercentile={null}
        durationSeconds={1 * 3600 + 54 * 60 + 32}
      />,
    );
    expect(screen.getByTestId('hero-meta-duration').textContent).toMatch(/1:54:32/);
  });

  it('action buttons fire callbacks', async () => {
    const onExport = vi.fn();
    const onReview = vi.fn();
    const user = userEvent.setup();
    render(
      <ScoreHero
        {...BASE}
        prevScoreDelta={null}
        defeatPercentile={null}
        onExportPdf={onExport}
        onContinueReview={onReview}
      />,
    );
    await user.click(screen.getByTestId('result-export-pdf'));
    await user.click(screen.getByTestId('result-continue-review'));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});
