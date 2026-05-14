import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuestionDispatcher from '@/components/questions/QuestionDispatcher';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 6 review-fix #7: rendererKey='graphic_reasoning' 直接 case 测试.
// BE follow-up backfill ETL 后会发该 key, 此 path 必须保留 + 不被
// isGraphicReasoning runtime 推断绕过.
//
// Mock lazy renderer 模块 — 全测试套跨 worker 跑时 lazy Suspense resolve
// 不稳定 (单跑 pass / 全跑 fail). Mock 后 dispatcher 决策路径直接同步可断言.

vi.mock('@/components/questions/SingleChoiceRenderer', () => ({
  default: () => <div data-testid="mock-single-choice" />,
}));
vi.mock('@/components/questions/MultipleChoiceRenderer', () => ({
  default: () => <div data-testid="mock-multiple-choice" />,
}));
vi.mock('@/components/questions/FillBlankRenderer', () => ({
  default: () => <div data-testid="mock-fill-blank" />,
}));
vi.mock('@/components/questions/EssayRenderer', () => ({
  default: () => <div data-testid="mock-essay" />,
}));
vi.mock('@/components/questions/GraphicReasoningRenderer', () => ({
  default: () => <div data-testid="mock-graphic-reasoning" />,
}));

function makeQuestion(args: {
  rendererKey: string;
  questionKind?: string;
  stem: string;
  options?: Array<{ key: string; text: string }>;
}): QuestionDetailV2 {
  return {
    questionId: 999,
    paperRevisionId: '1',
    sectionId: 's',
    blockId: 'b',
    questionNo: 1,
    questionKind: args.questionKind ?? args.rendererKey,
    rendererKey: args.rendererKey,
    content: { stem: args.stem, options: args.options },
  };
}

describe('QuestionDispatcher', () => {
  beforeEach(() => {
    usePracticeStore.setState({ answers: {} });
  });

  it('rendererKey=graphic_reasoning 直命中 → GraphicReasoningRenderer (无需 stem 含 img)', async () => {
    const q = makeQuestion({
      rendererKey: 'graphic_reasoning',
      stem: '<p>纯文字 stem 不含 img</p>',
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
        { key: 'C', text: 'C' },
        { key: 'D', text: 'D' },
      ],
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-graphic-reasoning')).toBeInTheDocument();
  });

  it('rendererKey=single_choice + stem 含 img + opts 单字母 → runtime 推断走 GraphicReasoningRenderer', async () => {
    const q = makeQuestion({
      rendererKey: 'single_choice',
      stem: '<p><img src="x.png" alt="题图" /></p>',
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
        { key: 'C', text: 'C' },
        { key: 'D', text: 'D' },
      ],
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-graphic-reasoning')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-single-choice')).toBeNull();
  });

  it('rendererKey=single_choice + stem 含 img + opts 文字 → SingleChoiceRenderer (防误判)', async () => {
    const q = makeQuestion({
      rendererKey: 'single_choice',
      stem: '<p>下图饼图: <img src="pie.png" /></p>',
      options: [
        { key: 'A', text: '50%' },
        { key: 'B', text: '60%' },
        { key: 'C', text: '70%' },
        { key: 'D', text: '80%' },
      ],
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-single-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-graphic-reasoning')).toBeNull();
  });

  it('rendererKey=multiple_choice → MultipleChoiceRenderer (即使 stem 含 img)', async () => {
    const q = makeQuestion({
      rendererKey: 'multiple_choice',
      stem: '<p><img src="x.png" /></p>',
      options: [
        { key: 'A', text: 'A 选项文字' },
        { key: 'B', text: 'B 选项文字' },
      ],
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-multiple-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-graphic-reasoning')).toBeNull();
  });

  it('rendererKey=fill_blank → FillBlankRenderer', async () => {
    const q = makeQuestion({
      rendererKey: 'fill_blank',
      stem: '<p>填空题</p>',
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-fill-blank')).toBeInTheDocument();
  });

  it('rendererKey=essay → EssayRenderer', async () => {
    const q = makeQuestion({
      rendererKey: 'essay',
      stem: '<p>申论题</p>',
    });
    render(<QuestionDispatcher question={q} />);
    expect(await screen.findByTestId('mock-essay')).toBeInTheDocument();
  });
});
