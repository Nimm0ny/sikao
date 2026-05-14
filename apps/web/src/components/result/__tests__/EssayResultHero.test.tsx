import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EssayResultHero } from '../EssayResultHero';

describe('EssayResultHero', () => {
  it('renders score with .toFixed(1) + " / N" + headline', () => {
    render(<EssayResultHero score={68.5} maxScore={100} headline="结构稳了" />);
    expect(screen.getByTestId('essay-result-hero-score').textContent).toMatch(/68\.5/);
    expect(screen.getByTestId('essay-result-hero-max').textContent).toMatch(/100/);
    expect(screen.getByTestId('essay-result-hero-headline').textContent).toBe('结构稳了');
  });

  it('omits eyebrow / lbl / subtitle / actions when not provided', () => {
    render(<EssayResultHero score={70} maxScore={100} headline="A" />);
    expect(screen.queryByTestId('essay-result-hero-eyebrow')).toBeNull();
    expect(screen.queryByTestId('essay-result-hero-lbl')).toBeNull();
    expect(screen.queryByTestId('essay-result-hero-subtitle')).toBeNull();
    expect(screen.queryByTestId('essay-result-hero-actions')).toBeNull();
  });

  it('renders eyebrow / lbl / subtitle when provided', () => {
    render(
      <EssayResultHero
        score={70}
        maxScore={100}
        eyebrow="Report · 申论 · 2026 国考"
        lbl="SCORE · 申论 · 比上次 +4.2"
        headline="结构稳了"
        subtitle="副标内容"
      />,
    );
    expect(screen.getByTestId('essay-result-hero-eyebrow').textContent).toMatch(/2026/);
    expect(screen.getByTestId('essay-result-hero-lbl').textContent).toMatch(/比上次/);
    expect(screen.getByTestId('essay-result-hero-subtitle').textContent).toBe('副标内容');
  });

  it('renders headerActions slot when provided', () => {
    render(
      <EssayResultHero
        score={70}
        maxScore={100}
        headline="A"
        headerActions={<button data-testid="hero-action">导出</button>}
      />,
    );
    expect(screen.getByTestId('essay-result-hero-actions')).toBeInTheDocument();
    expect(screen.getByTestId('hero-action')).toBeInTheDocument();
  });

  it('respects testIdPrefix', () => {
    render(
      <EssayResultHero
        score={70}
        maxScore={100}
        headline="A"
        testIdPrefix="exam-hero"
      />,
    );
    expect(screen.getByTestId('exam-hero')).toBeInTheDocument();
    expect(screen.getByTestId('exam-hero-score')).toBeInTheDocument();
    expect(screen.getByTestId('exam-hero-headline')).toBeInTheDocument();
  });

  it('CJK headline / subtitle 不带 italic (CLAUDE.md §4 italic 政策)', () => {
    render(
      <EssayResultHero
        score={70}
        maxScore={100}
        headline="结构稳了"
        subtitle="字数维度站住了"
      />,
    );
    // 走 design system token, 不应带 italic className. lint:italic 已巡检,
    // 这里走 dom snapshot 防 regression.
    const headline = screen.getByTestId('essay-result-hero-headline');
    const subtitle = screen.getByTestId('essay-result-hero-subtitle');
    expect(headline.className).not.toMatch(/italic/);
    expect(subtitle.className).not.toMatch(/italic/);
  });

  it('handles non-finite score gracefully → 0.0 fallback', () => {
    render(<EssayResultHero score={NaN} maxScore={100} headline="A" />);
    expect(screen.getByTestId('essay-result-hero-score').textContent).toMatch(/0\.0/);
  });
});
