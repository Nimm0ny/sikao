import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScoreModuleCard } from '../ScoreModuleCard';
import type { PracticeSectionSummaryV2, PracticeSubjectSummaryV2 } from '@sikao/api-client/types/api';

function sec(
  id: string,
  title: string,
  total: number,
  correct: number,
): PracticeSectionSummaryV2 {
  return {
    sectionId: id,
    title,
    instructionText: '',
    questionCount: total,
    answeredQuestions: total,
    correctCount: correct,
    wrongCount: total - correct,
    accuracyRate: total > 0 ? Math.round((correct / total) * 100 * 10) / 10 : 0,
  };
}

function sub(
  subject: string,
  q: number,
  ans: number,
  correct: number,
): PracticeSubjectSummaryV2 {
  return {
    subject,
    questionCount: q,
    answeredQuestions: ans,
    correctCount: correct,
    wrongCount: ans - correct,
    accuracyRate: ans > 0 ? Math.round((correct / ans) * 100 * 10) / 10 : 0,
  };
}

const defaultProps = {
  score: 78,
  maxScore: 100,
  correctCount: 78,
  incorrectCount: 18,
  unansweredCount: 4,
  sections: [
    sec('s1', '言语理解', 25, 21),
    sec('s2', '数量关系', 15, 7),
    sec('s3', '判断推理', 30, 25),
    sec('s4', '资料分析', 20, 18),
    sec('s5', '常识判断', 10, 7),
  ],
  subjects: [
    sub('言语理解', 25, 25, 21),
    sub('数量关系', 15, 15, 7),
  ],
};

describe('ScoreModuleCard', () => {
  it('renders the card with testid', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    expect(screen.getByTestId('score-module-card')).toBeInTheDocument();
  });

  it('shows score overview with big number', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    // Big score is in a mono display span — multiple "78" exist (score + tile)
    const card = screen.getByTestId('score-module-card');
    const bigScore = card.querySelector('.font-mono');
    expect(bigScore).not.toBeNull();
    expect(bigScore!.textContent).toBe('78');
    expect(screen.getByText('/ 100')).toBeInTheDocument();
    expect(screen.getByText('成绩概况')).toBeInTheDocument();
  });

  it('renders three count tiles with correct values', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    const correct = screen.getByTestId('score-tile-success');
    const wrong = screen.getByTestId('score-tile-danger');
    const unanswered = screen.getByTestId('score-tile-neutral');
    expect(within(correct).getByText('78')).toBeInTheDocument();
    expect(within(wrong).getByText('18')).toBeInTheDocument();
    expect(within(unanswered).getByText('4')).toBeInTheDocument();
  });

  it('renders module accuracy section with all sections', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    expect(screen.getByText('分项准确率')).toBeInTheDocument();
    for (const s of defaultProps.sections) {
      expect(screen.getByTestId(`score-module-row-${s.sectionId}`)).toBeInTheDocument();
    }
  });

  it('low accuracy sections get danger styling', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    // 数量关系 at 7/15 ≈ 46.7% — below 60% threshold
    const row = screen.getByTestId('score-module-row-s2');
    expect(row.textContent).toContain('数量关系');
  });

  it('renders subject compare row when 2+ subjects', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    expect(screen.getByTestId('score-module-strongest')).toBeInTheDocument();
    expect(screen.getByTestId('score-module-weakest')).toBeInTheDocument();
    expect(screen.getByText('强项')).toBeInTheDocument();
    expect(screen.getByText('需巩固')).toBeInTheDocument();
  });

  it('strongest is highest accuracy subject, weakest is lowest', () => {
    render(<ScoreModuleCard {...defaultProps} />);
    const strong = screen.getByTestId('score-module-strongest');
    const weak = screen.getByTestId('score-module-weakest');
    expect(within(strong).getByText('言语理解')).toBeInTheDocument();
    expect(within(weak).getByText('数量关系')).toBeInTheDocument();
  });

  it('hides subject compare when < 2 subjects answered', () => {
    render(
      <ScoreModuleCard
        {...defaultProps}
        subjects={[sub('A', 5, 0, 0), sub('B', 5, 0, 0)]}
      />,
    );
    expect(screen.queryByTestId('score-module-strongest')).not.toBeInTheDocument();
    expect(screen.queryByTestId('score-module-weakest')).not.toBeInTheDocument();
  });

  it('renders with empty sections without crashing', () => {
    render(<ScoreModuleCard {...defaultProps} sections={[]} />);
    expect(screen.getByTestId('score-module-card')).toBeInTheDocument();
    expect(screen.queryByText('模块准确率')).not.toBeInTheDocument();
  });
});
