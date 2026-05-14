import { describe, expect, it } from 'vitest';
import type { MaterialGroup, QuestionDetailV2, Section } from '@sikao/api-client/types/api';
import { buildPracticeDeckItems, findDeckIndexByQuestionId } from './buildPracticeDeckItems';

function makeQuestion(questionId: number, questionNo: number): QuestionDetailV2 {
  return {
    questionId,
    paperRevisionId: 'rev-1',
    sectionId: 'sec-1',
    blockId: `block-${questionId}`,
    questionNo,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: {
      stem: `题干 ${questionNo}`,
      options: [
        { key: 'A', text: '选项 A' },
        { key: 'B', text: '选项 B' },
      ],
    },
  };
}

function makeMaterialGroup(questions: readonly QuestionDetailV2[]): MaterialGroup {
  return {
    materialGroupId: 'mg-1',
    blockId: 'mg-block-1',
    title: '资料分析',
    content: '<p>材料正文</p>',
    groupKind: 'data_analysis',
    questions: [...questions],
    assets: [],
  };
}

describe('buildPracticeDeckItems', () => {
  it('keeps question blocks as single-question deck items in source order', () => {
    const sections: Section[] = [
      {
        sectionId: 'sec-1',
        title: '常识判断',
        blocks: [
          { blockId: 'b-1', type: 'question', question: makeQuestion(101, 1) },
          { blockId: 'b-2', type: 'question', question: makeQuestion(102, 2) },
        ],
      },
    ];

    const items = buildPracticeDeckItems(sections);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'question', id: 'question:101', sectionTitle: '常识判断' });
    expect(items[1]).toMatchObject({ kind: 'question', id: 'question:102', sectionTitle: '常识判断' });
  });

  it('splits a material group into five single-question deck items with shared material', () => {
    const groupQuestions = [1, 2, 3, 4, 5].map((no) => makeQuestion(200 + no, no));
    const sections: Section[] = [
      {
        sectionId: 'sec-data',
        title: '资料分析',
        blocks: [
          {
            blockId: 'mg-block-1',
            type: 'material_group',
            materialGroup: makeMaterialGroup(groupQuestions),
          },
        ],
      },
    ];

    const items = buildPracticeDeckItems(sections);

    expect(items).toHaveLength(5);
    expect(items.every((item) => item.kind === 'material_question')).toBe(true);
    expect(items.map((item) => item.id)).toEqual([
      'material:mg-1:question:201',
      'material:mg-1:question:202',
      'material:mg-1:question:203',
      'material:mg-1:question:204',
      'material:mg-1:question:205',
    ]);
    if (items[2]?.kind !== 'material_question') throw new Error('expected material question item');
    expect(items[2].materialGroup.title).toBe('资料分析');
    expect(items[2].question.questionNo).toBe(3);
    expect(items[2].groupQuestionIndex).toBe(2);
    expect(items[2].groupQuestionCount).toBe(5);
  });

  it('throws when a material group does not contain exactly five questions', () => {
    const shortGroup = [1, 2, 3, 4].map((no) => makeQuestion(300 + no, no));
    const sections: Section[] = [
      {
        sectionId: 'sec-data',
        title: '资料分析',
        blocks: [
          {
            blockId: 'mg-block-short',
            type: 'material_group',
            materialGroup: makeMaterialGroup(shortGroup),
          },
        ],
      },
    ];

    expect(() => buildPracticeDeckItems(sections)).toThrow('material group must contain exactly five questions');
  });

  it('maps each material question id back to its own deck index', () => {
    const groupQuestions = [1, 2, 3, 4, 5].map((no) => makeQuestion(400 + no, no));
    const sections: Section[] = [
      {
        sectionId: 'sec-1',
        title: '混合模块',
        blocks: [
          { blockId: 'b-1', type: 'question', question: makeQuestion(100, 1) },
          { blockId: 'mg-block-1', type: 'material_group', materialGroup: makeMaterialGroup(groupQuestions) },
          { blockId: 'b-2', type: 'question', question: makeQuestion(101, 7) },
        ],
      },
    ];

    const items = buildPracticeDeckItems(sections);

    expect(findDeckIndexByQuestionId(items, '401')).toBe(1);
    expect(findDeckIndexByQuestionId(items, '403')).toBe(3);
    expect(findDeckIndexByQuestionId(items, '101')).toBe(6);
  });
});
