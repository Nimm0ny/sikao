import { describe, expect, it } from 'vitest';
import type { QuestionDetailV2, Section, MaterialGroup } from '@sikao/api-client/types/api';
import { buildSectionGroups, buildSectionItems } from '../sectionGroups';

// P4/3 sectionGroups derivation tests:
// - buildSectionGroups (P3, existing) flat 行为不变
// - buildSectionItems (P4, new) discriminated union 保留 material_group 元信息
// - displayNo 跨 material 子题连续累计

function q(id: number, blockId: string): QuestionDetailV2 {
  return {
    questionId: id,
    paperRevisionId: '1',
    sectionId: 'sec-A',
    blockId,
    questionNo: id,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: { stem: `题 ${id}`, options: [{ key: 'A', text: 'A' }] },
  };
}

function mg(id: string, content: string, questions: QuestionDetailV2[]): MaterialGroup {
  return {
    materialGroupId: id,
    blockId: 'mg-block',
    title: '材料',
    content,
    groupKind: 'data_analysis',
    questions,
  };
}

describe('buildSectionItems (P4/3)', () => {
  it('builds question kind item for question block', () => {
    const sections: Section[] = [
      {
        sectionId: 'sec-A',
        title: '常识',
        blocks: [{ blockId: 'b-1', type: 'question', question: q(1, 'b-1') }],
      },
    ];
    const groups = buildSectionItems(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    const item = groups[0].items[0];
    expect(item.kind).toBe('question');
    if (item.kind === 'question') {
      expect(item.question.questionId).toBe(1);
      expect(item.displayNo).toBe(1);
    }
  });

  it('builds material-group kind item retaining materialGroup ref', () => {
    const materialGroup = mg('mg-1', '<p>材料</p>', [q(2, 'b-2'), q(3, 'b-2')]);
    const sections: Section[] = [
      {
        sectionId: 'sec-A',
        title: '资料分析',
        blocks: [{ blockId: 'mg-block', type: 'material_group', materialGroup }],
      },
    ];
    const groups = buildSectionItems(sections);
    const item = groups[0].items[0];
    expect(item.kind).toBe('material-group');
    if (item.kind === 'material-group') {
      expect(item.materialGroup.materialGroupId).toBe('mg-1');
      expect(item.questions).toHaveLength(2);
      expect(item.questions[0].displayNo).toBe(1);
      expect(item.questions[1].displayNo).toBe(2);
    }
  });

  it('displayNo continuous across question + material-group blocks', () => {
    const materialGroup = mg('mg-1', 'x', [q(10, 'b-2'), q(11, 'b-2')]);
    const sections: Section[] = [
      {
        sectionId: 'sec-A',
        title: 'mixed',
        blocks: [
          { blockId: 'b-1', type: 'question', question: q(1, 'b-1') },
          { blockId: 'mg-block', type: 'material_group', materialGroup },
          { blockId: 'b-3', type: 'question', question: q(20, 'b-3') },
        ],
      },
    ];
    const groups = buildSectionItems(sections);
    expect(groups[0].items).toHaveLength(3);
    const [first, mid, last] = groups[0].items;
    if (first.kind === 'question') expect(first.displayNo).toBe(1);
    if (mid.kind === 'material-group') {
      expect(mid.questions[0].displayNo).toBe(2);
      expect(mid.questions[1].displayNo).toBe(3);
    }
    if (last.kind === 'question') expect(last.displayNo).toBe(4);
  });

  it('displayNo continuous across section boundaries', () => {
    const sections: Section[] = [
      {
        sectionId: 'sec-A',
        title: 'A',
        blocks: [
          { blockId: 'b-1', type: 'question', question: q(1, 'b-1') },
          { blockId: 'b-2', type: 'question', question: q(2, 'b-2') },
        ],
      },
      {
        sectionId: 'sec-B',
        title: 'B',
        blocks: [{ blockId: 'b-3', type: 'question', question: q(3, 'b-3') }],
      },
    ];
    const groups = buildSectionItems(sections);
    expect(groups).toHaveLength(2);
    if (groups[0].items[0].kind === 'question') expect(groups[0].items[0].displayNo).toBe(1);
    if (groups[0].items[1].kind === 'question') expect(groups[0].items[1].displayNo).toBe(2);
    if (groups[1].items[0].kind === 'question') expect(groups[1].items[0].displayNo).toBe(3);
  });

  it('matches buildSectionGroups displayNo for same input (flat consistency)', () => {
    const materialGroup = mg('mg-1', 'x', [q(50, 'b-2'), q(51, 'b-2')]);
    const sections: Section[] = [
      {
        sectionId: 'sec-A',
        title: 'mixed',
        blocks: [
          { blockId: 'b-1', type: 'question', question: q(1, 'b-1') },
          { blockId: 'mg-block', type: 'material_group', materialGroup },
        ],
      },
    ];
    const flatGroups = buildSectionGroups(sections);
    const itemsGroups = buildSectionItems(sections);
    // flat 跟 items 的 displayNo 应该一致 (跨 material 子题连续累计相同).
    const flatNos = flatGroups[0].questions.map((q) => q.displayNo);
    const itemsNos: number[] = [];
    for (const it of itemsGroups[0].items) {
      if (it.kind === 'question') itemsNos.push(it.displayNo);
      else itemsNos.push(...it.questions.map((s) => s.displayNo));
    }
    expect(flatNos).toEqual(itemsNos);
  });
});
