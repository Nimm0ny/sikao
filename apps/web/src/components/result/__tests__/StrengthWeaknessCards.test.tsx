import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StrengthWeaknessCards } from '../StrengthWeaknessCards';
import type { PracticeSubjectSummaryV2 } from '@sikao/api-client/types/api';

function s(subject: string, q: number, ans: number, correct: number): PracticeSubjectSummaryV2 {
  return {
    subject,
    questionCount: q,
    answeredQuestions: ans,
    correctCount: correct,
    wrongCount: ans - correct,
    accuracyRate: ans > 0 ? Math.round((correct / ans) * 100 * 10) / 10 : 0,
  };
}

describe('StrengthWeaknessCards', () => {
  it('returns null for empty subjects', () => {
    const { container } = render(<StrengthWeaknessCards subjects={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when all subjects have answered=0 (untouched paper)', () => {
    const { container } = render(
      <StrengthWeaknessCards subjects={[s('A', 5, 0, 0), s('B', 5, 0, 0)]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when only one subject has answered>0 (no contrast possible)', () => {
    const { container } = render(
      <StrengthWeaknessCards subjects={[s('A', 5, 3, 2), s('B', 5, 0, 0)]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders both cards when 2+ subjects have distinct accuracy', () => {
    render(
      <StrengthWeaknessCards
        subjects={[s('言语理解', 10, 10, 9), s('数量关系', 10, 10, 4)]}
      />,
    );
    expect(screen.getByTestId('strength-weakness-cards')).toBeInTheDocument();
    expect(screen.getByTestId('strength-card')).toBeInTheDocument();
    expect(screen.getByTestId('weakness-card')).toBeInTheDocument();
  });

  it('strongest card shows the subject with highest accuracy', () => {
    render(
      <StrengthWeaknessCards
        subjects={[s('数量关系', 10, 10, 4), s('言语理解', 10, 10, 9), s('判断推理', 10, 10, 7)]}
      />,
    );
    const strength = screen.getByTestId('strength-card');
    expect(within(strength).getByText('言语理解')).toBeInTheDocument();
    expect(within(strength).getByText(/准确率 90%/)).toBeInTheDocument();
  });

  it('weakest card shows the subject with lowest accuracy + wrong count', () => {
    render(
      <StrengthWeaknessCards
        subjects={[s('数量关系', 10, 10, 4), s('言语理解', 10, 10, 9), s('判断推理', 10, 10, 7)]}
      />,
    );
    const weakness = screen.getByTestId('weakness-card');
    expect(within(weakness).getByText('数量关系')).toBeInTheDocument();
    expect(within(weakness).getByText(/准确率 40%.*错 6 题.*10/)).toBeInTheDocument();
  });

  it('eyebrow labels are 强项 / 需巩固', () => {
    render(
      <StrengthWeaknessCards subjects={[s('A', 5, 5, 5), s('B', 5, 5, 1)]} />,
    );
    expect(within(screen.getByTestId('strength-card')).getByText('强项')).toBeInTheDocument();
    expect(within(screen.getByTestId('weakness-card')).getByText('需巩固')).toBeInTheDocument();
  });

  it('returns null when all answered subjects tied to one (defensive)', () => {
    // Two entries pointing to the same subject is a backend invariant
    // violation, but if it ever happens we shouldn't crash or show
    // "强 = 弱 = same subject"
    const { container } = render(
      <StrengthWeaknessCards subjects={[s('A', 5, 5, 5), s('A', 5, 5, 1)]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
