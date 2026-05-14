import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionToolbar } from '../SelectionToolbar';
import { useHighlightStore } from '@sikao/domain/xingce/useHighlightStore';

// P5b/1 SelectionToolbar — createPortal 浮工具条 a11y / 交互 / 4 swatch / clear /
// undo / Esc / 键盘 Left/Right 切按钮. jsdom Range / Selection API 不完整
// (selection 跨节点 getRangeAt 返回的 range 不一定准), 这里聚焦 SelectionToolbar
// 自身行为: 按钮 click handler / portal mount / a11y label / undo disabled 状态.
// 真实 selection 集成走 Chrome MCP 验收 scene.

function makeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  const base = {
    top: 200,
    left: 100,
    right: 300,
    bottom: 220,
    width: 200,
    height: 20,
    x: 100,
    y: 200,
  };
  return { ...base, ...overrides, toJSON: () => base } as DOMRect;
}

describe('SelectionToolbar', () => {
  beforeEach(() => {
    useHighlightStore.setState({ marks: {}, undoStack: [] });
    // viewport 1280x800 (默认 jsdom)
    Object.defineProperty(window, 'innerWidth', {
      value: 1280,
      configurable: true,
    });
  });

  it('createPortal mounts toolbar on document.body with role=toolbar + aria-label', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: '划线工具条' });
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.parentElement?.nodeName).toBe('BODY');
  });

  it('renders 4 swatch buttons with ordinal aria-label (L1-L4)', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('重点 (L1)')).toBeInTheDocument();
    expect(screen.getByLabelText('关注 (L2)')).toBeInTheDocument();
    expect(screen.getByLabelText('重要 (L3)')).toBeInTheDocument();
    expect(screen.getByLabelText('危险 (L4)')).toBeInTheDocument();
  });

  it('renders clear + undo buttons with aria-label', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('清除选区划线')).toBeInTheDocument();
    expect(screen.getByLabelText('撤销划线')).toBeInTheDocument();
  });

  it('undo button disabled when undoStack empty', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('撤销划线')).toBeDisabled();
  });

  it('undo button enabled after addMark (undoStack 非空)', () => {
    useHighlightStore.getState().addMark({
      id: 'm1',
      questionId: 'q1',
      textStart: 0,
      textLength: 3,
      colorKey: 'y',
      createdAt: Date.now(),
    });
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('撤销划线')).not.toBeDisabled();
  });

  it('Esc key calls onClose', () => {
    const onClose = vi.fn();
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking undo button fires useHighlightStore.undo (undoStack 减少)', async () => {
    const user = userEvent.setup();
    useHighlightStore.getState().addMark({
      id: 'm1',
      questionId: 'q1',
      textStart: 0,
      textLength: 3,
      colorKey: 'y',
      createdAt: Date.now(),
    });
    expect(useHighlightStore.getState().undoStack).toHaveLength(1);
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText('撤销划线'));
    expect(useHighlightStore.getState().undoStack).toHaveLength(0);
  });

  it('toolbar position above selection by default (top < rect.top)', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect({ top: 400 })}
        onClose={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: '划线工具条' });
    expect(toolbar.getAttribute('data-placement')).toBe('above');
    const topStr = toolbar.style.top.replace('px', '');
    // top = 400 - 40 - 8 = 352
    expect(parseFloat(topStr)).toBeCloseTo(352, 0);
  });

  it('toolbar falls back below when top < FbTopbar buffer (56px)', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect({ top: 40, bottom: 60 })}
        onClose={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: '划线工具条' });
    expect(toolbar.getAttribute('data-placement')).toBe('below');
    const topStr = toolbar.style.top.replace('px', '');
    // top = bottom + 8 = 60 + 8 = 68
    expect(parseFloat(topStr)).toBeCloseTo(68, 0);
  });

  it('toolbar viewport clamp: left = 8 when selection rect 极左', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect({ left: 0, right: 20, width: 20 })}
        onClose={vi.fn()}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: '划线工具条' });
    const leftStr = toolbar.style.left.replace('px', '');
    expect(parseFloat(leftStr)).toBeCloseTo(8, 0);
  });

  it('swatch button has fb-hl-swatch--<key> class for color CSS', () => {
    render(
      <SelectionToolbar
        questionId="q1"
        rect={makeRect()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('重点 (L1)').className).toMatch(/fb-hl-swatch--y/);
    expect(screen.getByLabelText('关注 (L2)').className).toMatch(/fb-hl-swatch--g/);
    expect(screen.getByLabelText('重要 (L3)').className).toMatch(/fb-hl-swatch--b/);
    expect(screen.getByLabelText('危险 (L4)').className).toMatch(/fb-hl-swatch--p/);
  });
});
