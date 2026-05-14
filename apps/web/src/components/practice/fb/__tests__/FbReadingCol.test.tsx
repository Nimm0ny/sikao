import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbReadingCol } from '../FbReadingCol';
import type { QuestionDetailV2, MaterialGroup } from '@sikao/api-client/types/api';
import type { SectionItemsGroup } from '../sectionGroups';

// P4/3 FbReadingCol wire 测试:
// - 单题 kind 渲 FbCard
// - material-group kind 渲 FbPassage + 子题 FbCard + anchor strip
// - 锚跳 button 触发 scrollIntoView

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
  onExit: vi.fn(),
  registerQuestionCard: vi.fn(),
  onTogglePassagesCollapsed: vi.fn(),
  onForceExpandPassages: vi.fn(),
};

function renderFbReadingCol(groups: readonly SectionItemsGroup[]) {
  return render(
    <FbReadingCol
      sectionItemsGroups={groups}
      currentVisibleQid={null}
      answers={{}}
      flagged={new Set()}
      answeredCount={0}
      totalQuestions={1}
      passagesCollapsed={false}
      {...baseHandlers}
    />,
  );
}

describe('FbReadingCol (P4/3 wire)', () => {
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
    expect(screen.queryByTestId(/fb-passage/)).not.toBeInTheDocument();
  });

  it('renders FbPassage + sub-question FbCards for material-group kind', () => {
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
    expect(screen.getByTestId('fb-passage')).toBeInTheDocument();
    expect(screen.getByTestId('fb-material-group-mg-1')).toBeInTheDocument();
    expect(screen.getByTestId('fb-question-card-node-101')).toBeInTheDocument();
    expect(screen.getByTestId('fb-question-card-node-102')).toBeInTheDocument();
  });

  it('renders anchor strip after each sub-question with one button per paragraph', () => {
    const subQs = [q(201, '子题 1')];
    const materialGroup = mg('mg-2', '<p>段一</p><p>段二</p><p>段三</p>', subQs);
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
    const strip = screen.getByTestId('fb-anchor-strip-201');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveAttribute('aria-label', '回跳材料段落');
    expect(screen.getByTestId('fb-anchor-jump-201-passage-p1')).toBeInTheDocument();
    expect(screen.getByTestId('fb-anchor-jump-201-passage-p2')).toBeInTheDocument();
    expect(screen.getByTestId('fb-anchor-jump-201-passage-p3')).toBeInTheDocument();
  });

  it('clicking anchor button activates target passage tab + scrollIntoView', async () => {
    const user = userEvent.setup();
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
    renderFbReadingCol(groups);
    // 默认 passage-p1 active
    expect(screen.getByTestId('fb-passage-tab-passage-p1')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByTestId('fb-anchor-jump-301-passage-p2'));
    // active 切到 p2
    expect(screen.getByTestId('fb-passage-tab-passage-p2')).toHaveAttribute('aria-selected', 'true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('mixed section: question + material-group renders both kinds', () => {
    const subQs = [q(401, '子题')];
    const materialGroup = mg('mg-4', '<p>段</p>', subQs);
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
    expect(screen.getByTestId('fb-passage')).toBeInTheDocument();
    expect(screen.getByTestId('fb-question-card-node-401')).toBeInTheDocument();
  });
});
