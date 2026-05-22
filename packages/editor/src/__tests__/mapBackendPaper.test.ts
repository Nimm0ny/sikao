import { describe, expect, it } from 'vitest';
import {
  mapBackendEssayPaper,
  type BackendEssayQuestion,
} from '@sikao/domain/shenlun/mapBackendPaper';

describe('mapBackendEssayPaper', () => {
  it('maps existing backend essay question contract into exam Paper', () => {
    const paper = mapBackendEssayPaper('AIPTA-2024-01', makeQuestions());

    expect(paper.code).toBe('AIPTA-2024-01');
    expect(paper.questions).toHaveLength(5);
    expect(paper.materials).toHaveLength(4);
    expect(paper.materials[0]).toMatchObject({
      id: 'm1',
      title: '资料一',
      subtitle: '材料一第一段。',
    });
    expect(paper.questions[0]).toMatchObject({
      no: '第一题',
      kind: '概括',
      minWords: 200,
      maxWords: 250,
      backendId: 1,       // 透传 backend question.id, 整卷交卷时作 grade POST 的 questionId
      fullScore: 40,      // 透传 essayMetadata.fullScore, 整卷成绩按此加权 (review P0 #8)
      durationSec: 12 * 60,
      refMaterials: ['m1', 'm2', 'm3', 'm4'],
    });
    expect(paper.questions[0].body).toBe('请概括材料反映的问题。');
    expect(paper.questions[0].requirements).toContain('要求全面准确。');
    expect(paper.questions[0].requirements).toContain('不超过 250 字');
    expect(paper.questions[4]).toMatchObject({
      no: '第五题',
      kind: '作文',
      minWords: 1000,
      maxWords: 1200,
      durationSec: 45 * 60,
    });
  });

  it('keeps max-only backend limits out of minWords', () => {
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      content: {
        ...questions[0].content,
        essayMetadata: {
          materialTexts: MATERIALS,
          wordLimitMax: 300,
          suggestedMinutes: 10,
        },
      },
    };

    const paper = mapBackendEssayPaper('AIPTA-2026-01', questions);

    expect(paper.questions[0].minWords).toBeUndefined();
    expect(paper.questions[0].maxWords).toBe(300);
    expect(paper.questions[0].requirements).toContain('不超过 300 字');
  });

  it('supports real Shenlun papers with fewer than five essay questions', () => {
    const paper = mapBackendEssayPaper('SL-THREE', makeQuestions().slice(0, 3));

    expect(paper.questions).toHaveLength(3);
    expect(paper.questions.map((question) => question.no)).toEqual([
      '第一题',
      '第二题',
      '第三题',
    ]);
  });

  it('supports four-question papers (e.g. 国考行政执法卷)', () => {
    const paper = mapBackendEssayPaper('SL-FOUR', makeQuestions().slice(0, 4));

    expect(paper.questions).toHaveLength(4);
    expect(paper.questions.map((question) => question.no)).toEqual([
      '第一题',
      '第二题',
      '第三题',
      '第四题',
    ]);
  });

  it('supports a single-question paper (mapper has no min count beyond 1)', () => {
    const paper = mapBackendEssayPaper('SL-ONE', makeQuestions().slice(0, 1));

    expect(paper.questions).toHaveLength(1);
    expect(paper.questions[0].no).toBe('第一题');
  });

  it('throws when backend does not provide essay questions', () => {
    expect(() =>
      mapBackendEssayPaper(
        'BROKEN',
        makeQuestions().map((question) => ({ ...question, rendererKey: 'single' })),
      ),
    ).toThrow('essay exam requires at least one essay question: BROKEN');
  });

  it('uses backend canonical subtype when available', () => {
    const questions = makeQuestions();
    questions[1] = { ...questions[1], canonicalSubtype: '公文/应用文' };
    questions[2] = { ...questions[2], canonicalSubtype: '大作文' };

    const paper = mapBackendEssayPaper('CANONICAL', questions);

    expect(paper.questions[1].kind).toBe('应用文');
    expect(paper.questions[2].kind).toBe('作文');
  });

  it('keeps legacy canonical subtype mapping for imported papers', () => {
    const questions = makeQuestions();
    questions[1] = { ...questions[1], canonicalSubtype: '贯彻执行' };
    questions[2] = { ...questions[2], canonicalSubtype: '文章写作' };

    const paper = mapBackendEssayPaper('LEGACY-CANONICAL', questions);

    expect(paper.questions[1].kind).toBe('应用文');
    expect(paper.questions[2].kind).toBe('作文');
  });

  it('canonicalSubtype "其他" falls through to stem sniff (no silent map to 概括)', () => {
    // backend "其他" 表示 classify_question 兜底 (待人工分类). FE 不静默映射,
    // 走 stem 嗅探. 此 fixture stem 含 "议论文" → 嗅探到 "作文", 不是 "概括".
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      canonicalSubtype: '其他',
      stemText: '请就给定材料反映的现象, 写一篇议论文, 自拟题目。',
      content: {
        ...questions[0].content,
        stem: '请就给定材料反映的现象, 写一篇议论文, 自拟题目。',
      },
    };

    const paper = mapBackendEssayPaper('UNCLASSIFIED', questions);
    expect(paper.questions[0].kind).toBe('作文');
  });

  it('canonicalSubtype null falls through to stem sniff', () => {
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      canonicalSubtype: null,
      stemText: '针对材料中的问题, 提出对策建议。',
      content: { ...questions[0].content, stem: '针对材料中的问题, 提出对策建议。' },
    };

    const paper = mapBackendEssayPaper('NULL-CANONICAL', questions);
    expect(paper.questions[0].kind).toBe('对策');
  });

  it('throws when materialTexts is missing', () => {
    const questions = makeQuestions().map((question) => ({
      ...question,
      content: { ...question.content, essayMetadata: { wordLimitMin: 200 } },
    }));
    expect(() => mapBackendEssayPaper('NO-MATERIAL', questions)).toThrow(
      'essay exam materialTexts missing: NO-MATERIAL',
    );
  });

  it('throws when word limit is missing', () => {
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      content: {
        ...questions[0].content,
        essayMetadata: { materialTexts: MATERIALS },
      },
    };
    expect(() => mapBackendEssayPaper('NO-LIMIT', questions)).toThrow(
      'essay question word limit missing: 1',
    );
  });

  it('keeps min-only backend limits out of maxWords', () => {
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      content: {
        ...questions[0].content,
        essayMetadata: {
          materialTexts: MATERIALS,
          wordLimitMin: 200,
          suggestedMinutes: 10,
        },
      },
    };

    const paper = mapBackendEssayPaper('AIPTA-MIN-ONLY', questions);

    expect(paper.questions[0].minWords).toBe(200);
    expect(paper.questions[0].maxWords).toBeUndefined();
    expect(paper.questions[0].requirements).not.toContain('不超过');
  });

  it('throws when suggestedMinutes is missing (no silent hardcoded fallback)', () => {
    const questions = makeQuestions();
    questions[0] = {
      ...questions[0],
      content: {
        ...questions[0].content,
        essayMetadata: {
          materialTexts: MATERIALS,
          wordLimitMin: 200,
          wordLimitMax: 250,
        },
      },
    };
    expect(() => mapBackendEssayPaper('NO-DURATION', questions)).toThrow(
      'essay question suggestedMinutes missing: 1',
    );
  });
});

const MATERIALS = [
  '材料一第一段。\n材料一第二段。',
  '材料二。',
  '材料三。',
  '材料四。',
] as const;

function makeQuestions(): BackendEssayQuestion[] {
  return [1, 2, 3, 4, 5].map((position) => ({
    id: position,
    position,
    rendererKey: 'essay',
    stemText: `<p>${stem(position)}</p>`,
    explanationText: `<p>${requirement(position)}</p>`,
    content: {
      stem: `<p>${stem(position)}</p>`,
      essayMetadata: {
        materialTexts: MATERIALS,
        wordLimitMin: [200, 300, 400, 500, 1000][position - 1],
        wordLimitMax: [250, 350, 450, 550, 1200][position - 1],
        suggestedMinutes: [12, 15, 20, 22, 45][position - 1],
        fullScore: 40,
      },
    },
  }));
}

function stem(position: number): string {
  if (position === 1) return '请概括材料反映的问题。';
  if (position === 5) return '请围绕主题写一篇文章。';
  return `第 ${position} 题题干。`;
}

function requirement(position: number): string {
  if (position === 1) return '要求全面准确。';
  return `第 ${position} 题要求。`;
}
