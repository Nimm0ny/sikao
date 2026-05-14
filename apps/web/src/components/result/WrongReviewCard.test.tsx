import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WrongReviewCard } from './WrongReviewCard';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQuestion(overrides: Partial<QuestionDetailV2['content']> = {}): QuestionDetailV2 {
  return {
    questionId: 9001,
    paperRevisionId: 'rev-1',
    sectionId: 'sec-1',
    blockId: 'b-1',
    questionNo: 12,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem: '<p>下列哪项是 Python 关键字?</p>',
      options: [
        { key: 'A', text: '类' },
        { key: 'B', text: 'def' },
      ],
      explanation: 'def 是 Python 关键字',
      ...overrides,
    },
  };
}

describe('WrongReviewCard', () => {
  it('renders question stem and options', () => {
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
      />,
    );
    expect(screen.getByTestId('wrong-review-9001')).toBeInTheDocument();
    expect(screen.getByText(/下列哪项是 Python 关键字/)).toBeInTheDocument();
    expect(screen.getByText('类')).toBeInTheDocument();
    expect(screen.getByText('def')).toBeInTheDocument();
  });

  it('shows category label appended to question badge when provided', () => {
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
        categoryLabel="言语理解 / 片段阅读"
      />,
    );
    expect(screen.getByText(/言语理解 \/ 片段阅读/)).toBeInTheDocument();
  });

  it('shows 未作答 in header when userKeys is empty', () => {
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={[]}
        correctKeys={['B']}
      />,
    );
    expect(screen.getByText(/未作答/)).toBeInTheDocument();
  });

  it('renders explanation block when explanation is non-empty', () => {
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
      />,
    );
    expect(screen.getByText('解析')).toBeInTheDocument();
    expect(screen.getByText(/def 是 Python 关键字/)).toBeInTheDocument();
  });

  it('omits explanation block when explanation is empty', () => {
    render(
      <WrongReviewCard
        question={makeQuestion({ explanation: '' })}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
      />,
    );
    expect(screen.queryByText('解析')).not.toBeInTheDocument();
  });

  it('triggers onViewDetail with stringified questionId when CTA clicked', async () => {
    const user = userEvent.setup();
    const onViewDetail = vi.fn();
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
        onViewDetail={onViewDetail}
      />,
    );
    await user.click(screen.getByTestId('wrong-review-detail-9001'));
    expect(onViewDetail).toHaveBeenCalledWith('9001');
  });

  it('hides detail CTA when onViewDetail prop omitted', () => {
    render(
      <WrongReviewCard
        question={makeQuestion()}
        questionNo={12}
        userKeys={['A']}
        correctKeys={['B']}
      />,
    );
    expect(screen.queryByTestId('wrong-review-detail-9001')).not.toBeInTheDocument();
  });
});
