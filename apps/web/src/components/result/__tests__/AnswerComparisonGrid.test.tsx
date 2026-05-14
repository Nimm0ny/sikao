import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerComparisonGrid } from '../AnswerComparisonGrid';
import type { PracticeSectionSummaryV2 } from '@sikao/api-client/types/api';

function sec(id: string, title: string, count: number, correct: number): PracticeSectionSummaryV2 {
  return {
    sectionId: id,
    title,
    instructionText: '',
    questionCount: count,
    answeredQuestions: count,
    correctCount: correct,
    wrongCount: count - correct,
    accuracyRate: count > 0 ? (correct / count) * 100 : 0,
  };
}

describe('AnswerComparisonGrid', () => {
  it('renders cells grouped by section with semantic state classes', () => {
    render(
      <AnswerComparisonGrid
        cells={[
          { questionId: '1', questionNo: 1, sectionId: 'A', state: 'correct' },
          { questionId: '2', questionNo: 2, sectionId: 'A', state: 'wrong' },
          { questionId: '3', questionNo: 3, sectionId: 'B', state: 'empty' },
        ]}
        sections={[sec('A', '言语', 2, 1), sec('B', '数量', 1, 0)]}
      />,
    );

    expect(screen.getByTestId('compare-section-A')).toBeInTheDocument();
    expect(screen.getByTestId('compare-section-B')).toBeInTheDocument();
    expect(screen.getByTestId('compare-cell-1')).toHaveAttribute('data-visual-state', 'correct');
    expect(screen.getByTestId('compare-cell-1')).toHaveClass('bg-ok-bg');
  });

  it('falls back to flat grid when sections meta is empty (legacy fixture)', () => {
    render(
      <AnswerComparisonGrid
        cells={[
          { questionId: '1', questionNo: 1, sectionId: 'X', state: 'correct' },
          { questionId: '2', questionNo: 2, sectionId: 'X', state: 'wrong' },
        ]}
        sections={[]}
      />,
    );
    expect(screen.queryByTestId('compare-section-X')).toBeNull();
    expect(screen.getByTestId('compare-cell-1')).toBeInTheDocument();
    expect(screen.getByTestId('compare-cell-2')).toBeInTheDocument();
  });

  it('cells with sectionId not in sections render in orphan row (no silent drop)', () => {
    render(
      <AnswerComparisonGrid
        cells={[
          { questionId: '1', questionNo: 1, sectionId: 'A', state: 'correct' },
          { questionId: '99', questionNo: 99, sectionId: 'GHOST', state: 'wrong' },
        ]}
        sections={[sec('A', '言语', 1, 1)]}
      />,
    );
    const orphan = screen.getByTestId('compare-section-orphan');
    expect(orphan.textContent).toMatch(/未归类/);
    expect(orphan.textContent).toMatch(/1 题/);
    expect(screen.getByTestId('compare-cell-99')).toBeInTheDocument();
  });

  it('weak section (<60%) gets danger-toned meta line', () => {
    render(
      <AnswerComparisonGrid
        cells={[
          { questionId: '1', questionNo: 1, sectionId: 'A', state: 'wrong' },
          { questionId: '2', questionNo: 2, sectionId: 'A', state: 'wrong' },
          { questionId: '3', questionNo: 3, sectionId: 'A', state: 'correct' },
        ]}
        sections={[sec('A', '数量', 3, 1)]}
      />,
    );
    const sectionEl = screen.getByTestId('compare-section-A');
    expect(sectionEl.textContent).toMatch(/1\/3 · 33%/);
    expect(sectionEl.querySelector('.text-err')).not.toBeNull();
  });
});
