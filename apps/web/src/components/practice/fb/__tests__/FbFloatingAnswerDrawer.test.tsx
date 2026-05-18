import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbFloatingAnswerDrawer } from '../FbFloatingAnswerDrawer';
import type { SectionGroup } from '../sectionGroups';

const sectionGroups: SectionGroup[] = [
  {
    sectionId: 'sec-1',
    title: '常识判断',
    chapterIndex: 1,
    questions: [
      {
        displayNo: 1,
        sectionId: 'sec-1',
        sectionTitle: '常识判断',
        question: { questionId: 101 } as SectionGroup['questions'][number]['question'],
      },
      {
        displayNo: 2,
        sectionId: 'sec-1',
        sectionTitle: '常识判断',
        question: { questionId: 102 } as SectionGroup['questions'][number]['question'],
      },
    ],
  },
];

describe('FbFloatingAnswerDrawer', () => {
  it('expands, collapses, and keeps answer status visible', async () => {
    const user = userEvent.setup();
    render(
      <FbFloatingAnswerDrawer
        sectionGroups={sectionGroups}
        answers={{ '101': ['A'] }}
        flagged={new Set(['102'])}
        currentVisibleQid="101"
        answeredCount={1}
        totalQuestions={2}
        onSelectQuestion={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fb-floating-answer-drawer')).toHaveAttribute(
      'data-collapsed',
      'false',
    );
    expect(screen.getByTestId('fb-floating-cell-101')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('fb-floating-cell-102')).toHaveAttribute('data-flagged', 'true');

    await user.click(screen.getByTestId('fb-floating-answer-toggle'));
    expect(screen.getByTestId('fb-floating-answer-drawer')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    expect(screen.queryByTestId('fb-floating-answer-body')).not.toBeInTheDocument();
  });

  it('selects a question from the floating drawer', async () => {
    const user = userEvent.setup();
    const onSelectQuestion = vi.fn();
    render(
      <FbFloatingAnswerDrawer
        sectionGroups={sectionGroups}
        answers={{}}
        flagged={new Set()}
        currentVisibleQid="101"
        answeredCount={0}
        totalQuestions={2}
        onSelectQuestion={onSelectQuestion}
      />,
    );

    await user.click(screen.getByTestId('fb-floating-cell-102'));
    expect(onSelectQuestion).toHaveBeenCalledWith('102');
  });
});
