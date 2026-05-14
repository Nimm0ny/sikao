import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EssayRenderer from '../EssayRenderer';
import type { EssayMetadata, QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQ(metadata?: EssayMetadata, stem = '<p>结合给定材料, 谈谈你的理解</p>'): QuestionDetailV2 {
  return {
    questionId: 7001,
    questionNo: 1,
    sectionId: 'sec-1',
    questionKind: 'essay',
    rendererKey: 'essay',
    content: { stem, options: [], essayMetadata: metadata },
  } as unknown as QuestionDetailV2;
}

const META_FULL: EssayMetadata = {
  materialTexts: ['材料一: 短文', '材料二: 数据'],
  wordLimitMin: 800,
  wordLimitMax: 1000,
  suggestedMinutes: 60,
  fullScore: 40,
};

describe('EssayRenderer', () => {
  it('renders stem + answer textarea + meta hints', () => {
    render(
      <EssayRenderer question={makeQ(META_FULL)} selectedAnswer={[]} onAnswerChange={vi.fn()} />,
    );
    expect(screen.getByTestId('essay-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('essay-answer-input')).toBeInTheDocument();
    // 字数计 + 范围 + 建议时间 + 满分 都显示
    expect(screen.getByTestId('essay-word-count')).toHaveTextContent(/0 字/);
    expect(screen.getByTestId('essay-word-range')).toHaveTextContent(/800.*1000/);
    expect(screen.getByText(/建议 60 分钟/)).toBeInTheDocument();
    expect(screen.getByText(/满分 40 分/)).toBeInTheDocument();
  });

  it('materials section default collapsed; toggle expands and re-collapses', async () => {
    const user = userEvent.setup();
    render(
      <EssayRenderer question={makeQ(META_FULL)} selectedAnswer={[]} onAnswerChange={vi.fn()} />,
    );
    // 默认折叠: body 不在 DOM
    expect(screen.queryByTestId('essay-materials-body')).not.toBeInTheDocument();
    const toggle = screen.getByTestId('essay-materials-toggle');
    await user.click(toggle);
    expect(screen.getByTestId('essay-materials-body')).toBeInTheDocument();
    expect(screen.getByText('材料一: 短文')).toBeInTheDocument();
    expect(screen.getByText('材料二: 数据')).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByTestId('essay-materials-body')).not.toBeInTheDocument();
  });

  it('omits materials section when no materials given', () => {
    render(
      <EssayRenderer
        question={makeQ({ wordLimitMax: 600 })}
        selectedAnswer={[]}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('essay-materials')).not.toBeInTheDocument();
  });

  it('typing updates char count + emits onAnswerChange with [fullText]', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EssayRenderer question={makeQ(META_FULL)} selectedAnswer={[]} onAnswerChange={onChange} />,
    );
    const ta = screen.getByTestId('essay-answer-input');
    await user.type(ta, '我的论点是');
    expect(onChange).toHaveBeenLastCalledWith(['我的论点是']);
    expect(screen.getByTestId('essay-word-count')).toHaveTextContent('5 字');
  });

  it('whitespace-only answer emits [] (treated as un-answered)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EssayRenderer question={makeQ(META_FULL)} selectedAnswer={[]} onAnswerChange={onChange} />,
    );
    await user.type(screen.getByTestId('essay-answer-input'), '   ');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows over-limit warn when count exceeds wordLimitMax', () => {
    // wordLimitMax=10, 预填 12 个字符通过 selectedAnswer 注入
    const longText = '一二三四五六七八九十甲乙';
    render(
      <EssayRenderer
        question={makeQ({ wordLimitMin: 5, wordLimitMax: 10 })}
        selectedAnswer={[longText]}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-word-count')).toHaveTextContent('12 字');
    expect(screen.getByTestId('essay-word-warn-over')).toBeInTheDocument();
    expect(screen.queryByTestId('essay-word-warn-under')).not.toBeInTheDocument();
  });

  it('shows under-limit hint when 0 < count < wordLimitMin (but not when empty)', () => {
    const { rerender } = render(
      <EssayRenderer
        question={makeQ({ wordLimitMin: 800, wordLimitMax: 1000 })}
        selectedAnswer={['只写了几个字']}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-word-warn-under')).toBeInTheDocument();
    // 空答案不该提示 "字数偏少" (没填的题别被催)
    rerender(
      <EssayRenderer
        question={makeQ({ wordLimitMin: 800, wordLimitMax: 1000 })}
        selectedAnswer={[]}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('essay-word-warn-under')).not.toBeInTheDocument();
  });

  it('uses questionId-suffixed dom ids (no collision in MaterialGroup)', () => {
    // Subagent review P1-1: 静态 'essay-answer' id 在 MaterialGroup 同时渲染多道
    // essay 时撞 id, label-htmlFor 失联. 验证 id 含 questionId.
    const { container } = render(
      <EssayRenderer question={makeQ(META_FULL)} selectedAnswer={[]} onAnswerChange={vi.fn()} />,
    );
    const ta = container.querySelector('textarea');
    const label = container.querySelector('label');
    expect(ta?.id).toBe('essay-answer-7001');
    expect(label?.getAttribute('for')).toBe('essay-answer-7001');
  });

  it('re-syncs textarea when selectedAnswer prop changes (cross-question nav)', () => {
    const { rerender } = render(
      <EssayRenderer
        question={makeQ(META_FULL)}
        selectedAnswer={['第一题答案']}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-answer-input')).toHaveValue('第一题答案');
    rerender(
      <EssayRenderer
        question={makeQ(META_FULL)}
        selectedAnswer={['第二题答案']}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('essay-answer-input')).toHaveValue('第二题答案');
  });
});
