import { describe, it, expect } from 'vitest';
import { isGraphicReasoning } from './isGraphicReasoning';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function q(args: {
  kind?: string;
  stem: string;
  options?: Array<{ key: string; text: string }>;
}): QuestionDetailV2 {
  return {
    questionId: 1,
    paperRevisionId: '1',
    sectionId: 's',
    blockId: 'b',
    questionNo: 1,
    questionKind: args.kind ?? 'single_choice',
    rendererKey: args.kind ?? 'single_choice',
    content: {
      stem: args.stem,
      options: args.options,
    },
  };
}

describe('isGraphicReasoning', () => {
  it('returns false for non single_choice', () => {
    expect(
      isGraphicReasoning(
        q({
          kind: 'multiple_choice',
          stem: '<p><img src="x.png" /></p>',
          options: [{ key: 'A', text: 'A' }],
        }),
      ),
    ).toBe(false);
    expect(
      isGraphicReasoning(
        q({
          kind: 'fill_blank',
          stem: '<p><img src="x.png" /></p>',
          options: [{ key: 'A', text: 'A' }],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when neither stem nor options contain img', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p>类比推理: A 对于 B</p>',
          options: [
            { key: 'A', text: '苹果' },
            { key: 'B', text: '橘子' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns true when stem has img + options all single letter A-D (整张题图模式)', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p>下图序列规律: <img src="series.png" /></p>',
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' },
            { key: 'C', text: 'C' },
            { key: 'D', text: 'D' },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('returns true when options contain img (分开图模式, 与 stem 是否有 img 无关)', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p>选最相似的图形:</p>',
          options: [
            { key: 'A', text: '<img src="A.png" />' },
            { key: 'B', text: '<img src="B.png" />' },
            { key: 'C', text: '<img src="C.png" />' },
            { key: 'D', text: '<img src="D.png" />' },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('returns false when stem has img but options are数字 (数量关系防误判)', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p>下图饼图占比: <img src="pie.png" />, 求 X 的人数</p>',
          options: [
            { key: 'A', text: '50' },
            { key: 'B', text: '60' },
            { key: 'C', text: '70' },
            { key: 'D', text: '80' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when stem has img but options are文字 (资料分析防误判)', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p>根据下图: <img src="data.png" /></p>',
          options: [
            { key: 'A', text: '上海经济增速最快' },
            { key: 'B', text: '北京经济增速最快' },
            { key: 'C', text: '深圳经济增速最快' },
            { key: 'D', text: '广州经济增速最快' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('returns false when options array is empty', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<p><img src="x.png" /></p>',
          options: [],
        }),
      ),
    ).toBe(false);
  });

  it('handles missing options field', () => {
    const question = q({
      stem: '<p><img src="x.png" /></p>',
    });
    delete (question.content as { options?: unknown }).options;
    expect(isGraphicReasoning(question)).toBe(false);
  });

  it('returns true for 5-option A-E single-letter (review-fix #5)', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<img src="x.png" />',
          options: ['A', 'B', 'C', 'D', 'E'].map((k) => ({ key: k, text: k })),
        }),
      ),
    ).toBe(true);
  });

  it('returns false when option text is HTML-wrapped letter (BE 不会发但防御)', () => {
    // review-fix #6: 当前实现对 '<p>A</p>' 这种 HTML-wrap 单字母不识别为单字母,
    // 会回退到 ImageOptionsGrid 渲染. 行为变化 (整张题图模式失效但仍能选答),
    // 不致命. 锁定当前行为防回归.
    expect(
      isGraphicReasoning(
        q({
          stem: '<img src="x.png" />',
          options: [
            { key: 'A', text: '<p>A</p>' },
            { key: 'B', text: '<p>B</p>' },
            { key: 'C', text: '<p>C</p>' },
            { key: 'D', text: '<p>D</p>' },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('handles whitespace around single-letter options', () => {
    expect(
      isGraphicReasoning(
        q({
          stem: '<img src="x.png" />',
          options: [
            { key: 'A', text: ' A ' },
            { key: 'B', text: 'B\n' },
            { key: 'C', text: '\tC' },
            { key: 'D', text: 'D' },
          ],
        }),
      ),
    ).toBe(true);
  });
});
