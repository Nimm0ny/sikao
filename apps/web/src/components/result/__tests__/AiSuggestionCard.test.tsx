import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSuggestionCard } from '../AiSuggestionCard';
import type { PracticeSubtypeSummaryV2 } from '@sikao/api-client/types/api';

function s(subject: string | null, subtype: string, q: number, ans: number, wrong: number): PracticeSubtypeSummaryV2 {
  return {
    subject,
    subtype,
    questionCount: q,
    answeredQuestions: ans,
    correctCount: ans - wrong,
    wrongCount: wrong,
    accuracyRate: ans > 0 ? Math.round(((ans - wrong) / ans) * 100 * 10) / 10 : 0,
  };
}

describe('AiSuggestionCard', () => {
  it('returns null for empty subtypes', () => {
    const { container } = render(<AiSuggestionCard subtypes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when no subtype has wrongCount > 0', () => {
    const { container } = render(
      <AiSuggestionCard subtypes={[s('A', 'a', 5, 5, 0), s('B', 'b', 5, 5, 0)]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('picks the subtype with highest wrongCount', () => {
    render(
      <AiSuggestionCard
        subtypes={[
          s('言语', '片段阅读', 10, 10, 2),
          s('资料', '增长率', 12, 12, 6),
          s('判断', '类比', 5, 5, 4),
        ]}
      />,
    );
    expect(screen.getByTestId('ai-suggestion-target')).toHaveTextContent('资料 · 增长率');
    expect(screen.getByText(/错 6 题/)).toBeInTheDocument();
  });

  it('tie-breaks by lower accuracyRate when wrongCount is equal', () => {
    render(
      <AiSuggestionCard
        subtypes={[
          // both wrong=3; 资料·增长率 has lower accuracy (3/4 = 75% vs 3/8 = 37.5%)
          s('言语', '片段阅读', 8, 8, 3),
          s('资料', '增长率', 4, 4, 3),
        ]}
      />,
    );
    expect(screen.getByTestId('ai-suggestion-target')).toHaveTextContent('资料 · 增长率');
  });

  it('shows just subtype when subject is null (no "subject ·" prefix)', () => {
    render(<AiSuggestionCard subtypes={[s(null, '杂项', 5, 5, 2)]} />);
    expect(screen.getByTestId('ai-suggestion-target')).toHaveTextContent('杂项');
    // The eyebrow "建议" should still render but isn't part of the target — and
    // the body sentence has 错/题 markers, not "·" formatting.
    expect(screen.getByTestId('ai-suggestion-target').textContent).not.toContain('·');
  });

  it('renders CTA <button> when onSelect provided', () => {
    const onSelect = vi.fn();
    render(<AiSuggestionCard subtypes={[s('A', 'aa', 5, 5, 2)]} onSelect={onSelect} />);
    expect(screen.getByTestId('ai-suggestion-cta')).toBeInTheDocument();
  });

  it('omits CTA <button> when onSelect is not provided', () => {
    render(<AiSuggestionCard subtypes={[s('A', 'aa', 5, 5, 2)]} />);
    expect(screen.queryByTestId('ai-suggestion-cta')).not.toBeInTheDocument();
  });

  it('clicking CTA fires onSelect with the picked (subject, subtype)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AiSuggestionCard
        subtypes={[s('言语', '片段阅读', 5, 5, 1), s('资料', '增长率', 5, 5, 4)]}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId('ai-suggestion-cta'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('资料', '增长率');
  });

  it('uses light accent gradient banner (Phase 4.7 redesign)', () => {
    render(<AiSuggestionCard subtypes={[s('A', 'aa', 5, 5, 1)]} />);
    const card = screen.getByTestId('ai-suggestion-card');
    expect(card.className).toContain('from-accent-50');
    expect(card.className).toContain('border-accent/20');
  });
});
