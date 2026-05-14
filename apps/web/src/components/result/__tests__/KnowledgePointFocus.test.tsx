import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgePointFocus } from '../KnowledgePointFocus';
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

describe('KnowledgePointFocus', () => {
  it('returns null for empty subtypes', () => {
    const { container } = render(<KnowledgePointFocus subtypes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when no subtype has wrongCount > 0', () => {
    const { container } = render(
      <KnowledgePointFocus
        subtypes={[s('言语理解', '片段阅读', 5, 5, 0), s('判断推理', '类比', 3, 3, 0)]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('sorts visible rows by wrongCount desc', () => {
    render(
      <KnowledgePointFocus
        subtypes={[
          s('A', 'aa', 10, 10, 2),
          s('B', 'bb', 10, 10, 6),
          s('C', 'cc', 10, 10, 4),
        ]}
      />,
    );
    const rows = screen.getAllByTestId(/kp-focus-row-/);
    expect(rows.map((r) => r.dataset.testid)).toEqual([
      'kp-focus-row-bb',
      'kp-focus-row-cc',
      'kp-focus-row-aa',
    ]);
  });

  it('caps visible rows to topN (default 5)', () => {
    const subtypes = Array.from({ length: 10 }, (_, i) => s('S', `t${i}`, 10, 10, i + 1));
    render(<KnowledgePointFocus subtypes={subtypes} />);
    expect(screen.getAllByTestId(/kp-focus-row-/)).toHaveLength(5);
  });

  it('respects custom topN', () => {
    const subtypes = Array.from({ length: 10 }, (_, i) => s('S', `t${i}`, 10, 10, i + 1));
    render(<KnowledgePointFocus subtypes={subtypes} topN={3} />);
    expect(screen.getAllByTestId(/kp-focus-row-/)).toHaveLength(3);
  });

  it('shows "subject · subtype" when subject present', () => {
    render(<KnowledgePointFocus subtypes={[s('言语理解', '片段阅读', 5, 5, 2)]} />);
    expect(screen.getByText('言语理解 · 片段阅读')).toBeInTheDocument();
  });

  it('shows just subtype when subject is null (no "subject ·" prefix)', () => {
    render(<KnowledgePointFocus subtypes={[s(null, '杂项', 5, 5, 2)]} />);
    // Scope assertion to the row — the card title "错题集中 · 知识点" contains
    // "·" which is unrelated to per-row formatting.
    const row = screen.getByTestId('kp-focus-row-杂项');
    expect(within(row).getByText('杂项')).toBeInTheDocument();
    expect(within(row).queryByText(/·/)).not.toBeInTheDocument();
  });

  it('shows ×N wrong count in danger color', () => {
    render(<KnowledgePointFocus subtypes={[s('A', 'aa', 10, 10, 4)]} />);
    const wc = screen.getByTestId('kp-focus-wrong-aa');
    expect(wc).toHaveTextContent('×4');
    expect(wc.className).toContain('text-err');
  });

  it('renders rows as <button> when onSelect is provided', () => {
    const onSelect = vi.fn();
    render(<KnowledgePointFocus subtypes={[s('A', 'aa', 5, 5, 2)]} onSelect={onSelect} />);
    expect(screen.getByTestId('kp-focus-row-aa').tagName).toBe('BUTTON');
  });

  it('renders rows as <div> when onSelect is omitted', () => {
    render(<KnowledgePointFocus subtypes={[s('A', 'aa', 5, 5, 2)]} />);
    expect(screen.getByTestId('kp-focus-row-aa').tagName).toBe('DIV');
  });

  it('clicking a row fires onSelect with (subject, subtype)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<KnowledgePointFocus subtypes={[s('言语理解', '片段阅读', 5, 5, 3)]} onSelect={onSelect} />);
    await user.click(screen.getByTestId('kp-focus-row-片段阅读'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('言语理解', '片段阅读');
  });
});
