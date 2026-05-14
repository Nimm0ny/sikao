import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MaterialGroup, QuestionDetailV2 } from '@sikao/api-client/types/api';
import { PracticeDeck } from './PracticeDeck';
import type { PracticeDeckItem } from './buildPracticeDeckItems';

vi.mock('@/components/QuestionDispatcher', () => ({
  default: ({ question }: { readonly question: QuestionDetailV2 }) => (
    <div data-testid={`mock-question-${question.questionId}`}>{question.content.stem}</div>
  ),
}));

function makeQuestion(questionId: number, questionNo: number): QuestionDetailV2 {
  return {
    questionId,
    paperRevisionId: 'rev-1',
    sectionId: 'sec-data',
    blockId: `block-${questionId}`,
    questionNo,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem: `资料题 ${questionNo}`,
      options: [
        { key: 'A', text: '选项 A' },
        { key: 'B', text: '选项 B' },
      ],
    },
  };
}

function makeMaterialGroup(): MaterialGroup {
  return {
    materialGroupId: 'mg-1',
    blockId: 'mg-block-1',
    title: '资料分析材料',
    content: '<p>这是固定阅读材料</p>',
    groupKind: 'data_analysis',
    questions: [1, 2, 3, 4, 5].map((no) => makeQuestion(500 + no, no)),
    assets: [],
  };
}

describe('PracticeDeck', () => {
  it('renders one material question while keeping the material pane fixed', () => {
    const materialGroup = makeMaterialGroup();
    const item: PracticeDeckItem = {
      kind: 'material_question',
      id: 'material:mg-1:question:503',
      sectionId: 'sec-data',
      sectionTitle: '资料分析',
      materialGroup,
      question: materialGroup.questions[2],
      groupQuestionIndex: 2,
      groupQuestionCount: 5,
    };

    render(<PracticeDeck item={item} currentIndex={0} totalItems={1} />);

    expect(screen.getByTestId('material-question-deck-card')).toBeInTheDocument();
    expect(screen.getByText('资料分析材料')).toBeInTheDocument();
    expect(screen.getByText('这是固定阅读材料')).toBeInTheDocument();
    expect(screen.getByTestId('material-question-pane')).toBeInTheDocument();
    expect(screen.getByTestId('mock-question-503')).toHaveTextContent('资料题 3');
    expect(screen.queryByTestId('mock-question-501')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-question-505')).not.toBeInTheDocument();
    expect(screen.getByTestId('material-local-question-nav')).toHaveTextContent('3');
  });

  it('calls onNext when a question card is dragged past the right threshold', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const item: PracticeDeckItem = {
      kind: 'question',
      id: 'question:101',
      sectionId: 'sec-1',
      sectionTitle: '常识判断',
      question: makeQuestion(101, 1),
    };

    render(
      <PracticeDeck
        item={item}
        currentIndex={0}
        totalItems={2}
        canGoNext
        onNext={onNext}
      />,
    );

    const card = screen.getByTestId('question-deck-card');
    await user.pointer([
      { keys: '[MouseLeft>]', target: card, coords: { x: 0, y: 0 } },
      { target: card, coords: { x: 150, y: 0 } },
      { keys: '[/MouseLeft]', target: card, coords: { x: 150, y: 0 } },
    ]);

    expect(onNext).toHaveBeenCalledOnce();
  });
});
