import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GraphicReasoningRenderer from './GraphicReasoningRenderer';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

function makeQuestion(args: {
  stem: string;
  options: Array<{ key: string; text: string }>;
}): QuestionDetailV2 {
  return {
    questionId: 1,
    paperRevisionId: '1',
    sectionId: 's',
    blockId: 'b',
    questionNo: 1,
    questionKind: 'single_choice',
    rendererKey: 'single_choice',
    content: { stem: args.stem, options: args.options },
  };
}

describe('GraphicReasoningRenderer', () => {
  it('renders sanitized stem HTML with img inside graphic-stem container', () => {
    const q = makeQuestion({
      stem: '<p>下图序列规律: <img src="series.png" alt="题图" /></p>',
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
        { key: 'C', text: 'C' },
        { key: 'D', text: 'D' },
      ],
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('graphic-reasoning-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('graphic-stem')).toBeInTheDocument();
    expect(screen.getByText(/下图序列规律/)).toBeInTheDocument();
    expect(screen.getByAltText('题图')).toBeInTheDocument();
  });

  it('all-single-letter options render as ABCD chip row (整张题图模式)', () => {
    const q = makeQuestion({
      stem: '<img src="x.png" alt="题图" />',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('graphic-options-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('graphic-options-grid')).toBeNull();
    ['A', 'B', 'C', 'D'].forEach((k) => {
      expect(screen.getByTestId(`graphic-chip-${k}`)).toBeInTheDocument();
    });
  });

  it('options with img render as image grid (分开图模式)', () => {
    const q = makeQuestion({
      stem: '<p>选最相似的:</p>',
      options: ['A', 'B', 'C', 'D'].map((k) => ({
        key: k,
        text: `<img src="opt_${k}.png" alt="选项${k}" />`,
      })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('graphic-options-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('graphic-options-chip')).toBeNull();
    ['A', 'B', 'C', 'D'].forEach((k) => {
      expect(screen.getByTestId(`graphic-cell-${k}`)).toBeInTheDocument();
      expect(screen.getByAltText(`选项${k}`)).toBeInTheDocument();
    });
  });

  it('chip click fires onAnswerChange with the option key', async () => {
    const onAnswerChange = vi.fn();
    const user = userEvent.setup();
    const q = makeQuestion({
      stem: '<img src="x.png" />',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={onAnswerChange} />);
    await user.click(screen.getByTestId('graphic-chip-B'));
    expect(onAnswerChange).toHaveBeenCalledWith(['B']);
  });

  it('image cell button click (target=button, not img) fires onAnswerChange', async () => {
    const onAnswerChange = vi.fn();
    const user = userEvent.setup();
    const q = makeQuestion({
      stem: '<p>选项:</p>',
      options: ['A', 'B', 'C', 'D'].map((k) => ({
        key: k,
        text: `<img src="opt_${k}.png" alt="${k}" />`,
      })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={onAnswerChange} />);
    // review-fix #8: getByTestId 拿 button 元素自身, click 直接派发到 button
    // (不经过子 img listener) → 触发 onSelect. 真实场景下用户点 cell padding/
    // letter chip 也是这个路径.
    await user.click(screen.getByTestId('graphic-cell-C'));
    expect(onAnswerChange).toHaveBeenCalledWith(['C']);
  });

  it('selectedAnswer marks the corresponding chip aria-checked=true', () => {
    const q = makeQuestion({
      stem: '<img src="x.png" />',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={['B']} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('graphic-chip-A')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('graphic-chip-B')).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking stem img opens lightbox with that src', () => {
    const q = makeQuestion({
      stem: '<p><img src="https://example.com/series.png" alt="题图" /></p>',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    const stemImg = screen.getByAltText('题图');
    fireEvent.click(stemImg);
    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument();
    expect(screen.getByTestId('image-lightbox-img')).toHaveAttribute('src', 'https://example.com/series.png');
  });

  it('5-option (A-E) all-single-letter still renders chip row + grid layout adapts', () => {
    const q = makeQuestion({
      stem: '<img src="x.png" alt="题图" />',
      options: ['A', 'B', 'C', 'D', 'E'].map((k) => ({ key: k, text: k })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />);
    expect(screen.getByTestId('graphic-options-chip')).toBeInTheDocument();
    ['A', 'B', 'C', 'D', 'E'].forEach((k) => {
      expect(screen.getByTestId(`graphic-chip-${k}`)).toBeInTheDocument();
    });
    // Wave D review-fix #5: grid 列数随 options.length 动态.
    expect(screen.getByTestId('graphic-options-chip').style.gridTemplateColumns).toContain(
      'repeat(5,',
    );
  });

  it('unmount removes stem img listeners (review-fix P0 cleanup defense)', () => {
    const q = makeQuestion({
      stem: '<p><img src="https://example.com/series.png" alt="题图" /></p>',
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: k })),
    });
    const { unmount } = render(
      <GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={vi.fn()} />,
    );
    // Unmount — useEffect cleanup 调 removeEventListener. img 元素本身离场,
    // 没法 fireEvent. 用 spy 验证 cleanup 实际运行 (没跑 = listener 泄漏).
    const removeSpy = vi.spyOn(HTMLImageElement.prototype, 'removeEventListener');
    unmount();
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('clicking option img opens lightbox with that src (does not select option)', () => {
    const onAnswerChange = vi.fn();
    const q = makeQuestion({
      stem: '<p>选项:</p>',
      options: ['A', 'B', 'C', 'D'].map((k) => ({
        key: k,
        text: `<img src="https://example.com/opt_${k}.png" alt="${k}" />`,
      })),
    });
    render(<GraphicReasoningRenderer question={q} selectedAnswer={[]} onAnswerChange={onAnswerChange} />);
    const imgB = screen.getByAltText('B');
    fireEvent.click(imgB);
    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument();
    expect(screen.getByTestId('image-lightbox-img')).toHaveAttribute('src', 'https://example.com/opt_B.png');
    // 关键: 选答没触发.
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});
