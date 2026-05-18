import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbReadingCol } from '../FbReadingCol';
import type { QuestionDetailV2, MaterialGroup } from '@sikao/api-client/types/api';
import type { SectionItemsGroup } from '../sectionGroups';

function q(id: number, stem: string): QuestionDetailV2 {
  return {
    questionId: id,
    paperRevisionId: '1',
    sectionId: 'sec-A',
    blockId: `b-${id}`,
    questionNo: id,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem,
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
      ],
    },
  };
}

function mg(id: string, content: string, questions: QuestionDetailV2[]): MaterialGroup {
  return {
    materialGroupId: id,
    blockId: 'mg-block',
    title: '材料一',
    content,
    groupKind: 'data_analysis',
    questions,
  };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const baseHandlers = {
  onAnswer: vi.fn(),
  onToggleMark: vi.fn(),
  onOpenNote: vi.fn(),
  registerQuestion: vi.fn(),
  unregisterQuestion: vi.fn(),
  onCurrentQuestionChange: vi.fn(),
  onTogglePassagesCollapsed: vi.fn(),
};

function renderFbReadingCol(
  groups: readonly SectionItemsGroup[],
  options: { readonly passagesCollapsed?: boolean } = {},
) {
  return render(
    <FbReadingCol
      sectionItemsGroups={groups}
      currentVisibleQid={null}
      answers={{}}
      flagged={new Set()}
      passagesCollapsed={options.passagesCollapsed ?? false}
      {...baseHandlers}
    />,
  );
}

describe('FbReadingCol redesign wire', () => {
  it('renders single FbCard for question kind item', () => {
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: '常识',
        chapterIndex: 1,
        items: [{ kind: 'question', question: q(1, '题目一'), displayNo: 1 }],
      },
    ];
    renderFbReadingCol(groups);
    expect(screen.getByTestId('fb-question-card-node-1')).toBeInTheDocument();
    expect(screen.queryByTestId(/fb-material-analysis/)).not.toBeInTheDocument();
    expect(baseHandlers.registerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: '1' }),
    );
  });

  it('renders one material pane and sub-question cards for material-group kind', () => {
    const subQs = [q(101, '资料分析子题 1'), q(102, '资料分析子题 2')];
    const materialGroup = mg('mg-1', '<p>段一</p><p>段二</p>', subQs);
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: '资料分析',
        chapterIndex: 1,
        items: [
          {
            kind: 'material-group',
            materialGroup,
            questions: [
              { question: subQs[0], displayNo: 1 },
              { question: subQs[1], displayNo: 2 },
            ],
          },
        ],
      },
    ];
    renderFbReadingCol(groups);
    expect(screen.getByTestId('fb-material-analysis-mg-1')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-body-mg-1')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-question-node-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-question-node-102')).toBeInTheDocument();
    expect(screen.getAllByText('段一')).toHaveLength(1);
  });

  it('tab click scrolls the right-side question pane and updates current question', async () => {
    const user = userEvent.setup();
    const subQs = [q(201, '子题 1'), q(202, '子题 2')];
    const materialGroup = mg('mg-2', '<p>段一</p><p>段二</p>', subQs);
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: '资料分析',
        chapterIndex: 1,
        items: [
          {
            kind: 'material-group',
            materialGroup,
            questions: [
              { question: subQs[0], displayNo: 1 },
              { question: subQs[1], displayNo: 2 },
            ],
          },
        ],
      },
    ];
    renderFbReadingCol(groups);

    await user.click(screen.getByTestId('fb-material-tab-202'));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(baseHandlers.onCurrentQuestionChange).toHaveBeenCalledWith('202');
  });

  it('collapses the material body while keeping the question pane available', () => {
    const subQs = [q(301, '子题 1')];
    const materialGroup = mg('mg-3', '<p>A</p><p>B</p>', subQs);
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: '资料分析',
        chapterIndex: 1,
        items: [
          {
            kind: 'material-group',
            materialGroup,
            questions: [{ question: subQs[0], displayNo: 1 }],
          },
        ],
      },
    ];
    renderFbReadingCol(groups, { passagesCollapsed: true });

    expect(screen.queryByTestId('fb-material-body-mg-3')).not.toBeInTheDocument();
    expect(screen.getByTestId('fb-material-question-node-301')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-collapse-mg-3')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('material collapse button calls the shared passage toggle handler', async () => {
    const user = userEvent.setup();
    const subQs = [q(401, '子题 1')];
    const materialGroup = mg('mg-4', '<p>A</p><p>B</p>', subQs);
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: '资料分析',
        chapterIndex: 1,
        items: [
          {
            kind: 'material-group',
            materialGroup,
            questions: [{ question: subQs[0], displayNo: 1 }],
          },
        ],
      },
    ];
    renderFbReadingCol(groups);

    await user.click(screen.getByTestId('fb-material-collapse-mg-4'));

    expect(baseHandlers.onTogglePassagesCollapsed).toHaveBeenCalledTimes(1);
  });

  it('mixed section: question + material-group renders both kinds', () => {
    const subQs = [q(501, '子题')];
    const materialGroup = mg('mg-5', '<p>段</p>', subQs);
    const groups: SectionItemsGroup[] = [
      {
        sectionId: 'sec-A',
        title: 'mixed',
        chapterIndex: 1,
        items: [
          { kind: 'question', question: q(1, '常识题'), displayNo: 1 },
          {
            kind: 'material-group',
            materialGroup,
            questions: [{ question: subQs[0], displayNo: 2 }],
          },
        ],
      },
    ];
    renderFbReadingCol(groups);
    expect(screen.getByTestId('fb-question-card-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-analysis-mg-5')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-question-node-501')).toBeInTheDocument();
  });
});
