import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FbBottomDock } from '../FbBottomDock';

describe('FbBottomDock', () => {
  const baseProps = {
    currentIndex: 3,
    totalQuestions: 35,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onOpenDrawer: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('renders 4 nav IconBtn (prev / next / open-drawer / submit) + question count', () => {
    render(<FbBottomDock {...baseProps} />);
    expect(screen.getByTestId('practice-bottom-dock-prev')).toBeInTheDocument();
    expect(screen.getByTestId('practice-bottom-dock-next')).toBeInTheDocument();
    expect(screen.getByTestId('practice-bottom-dock-open-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('practice-bottom-dock-submit')).toBeInTheDocument();
    expect(screen.getByTestId('practice-bottom-dock-question-count')).toHaveTextContent(
      '第 3 题 / 35',
    );
  });

  it('每个 IconBtn aria-label 中文 (a11y SVG-only)', () => {
    render(<FbBottomDock {...baseProps} />);
    expect(screen.getByTestId('practice-bottom-dock-prev')).toHaveAttribute(
      'aria-label',
      '上一题',
    );
    expect(screen.getByTestId('practice-bottom-dock-next')).toHaveAttribute(
      'aria-label',
      '下一题',
    );
    expect(screen.getByTestId('practice-bottom-dock-open-drawer')).toHaveAttribute(
      'aria-label',
      '打开答题卡',
    );
    expect(screen.getByTestId('practice-bottom-dock-submit')).toHaveAttribute(
      'aria-label',
      '提交答题',
    );
  });

  it('prev disabled 当 currentIndex=1', () => {
    render(<FbBottomDock {...baseProps} currentIndex={1} />);
    expect(screen.getByTestId('practice-bottom-dock-prev')).toBeDisabled();
    expect(screen.getByTestId('practice-bottom-dock-next')).not.toBeDisabled();
  });

  it('next disabled 当 currentIndex=totalQuestions', () => {
    render(<FbBottomDock {...baseProps} currentIndex={35} totalQuestions={35} />);
    expect(screen.getByTestId('practice-bottom-dock-next')).toBeDisabled();
    expect(screen.getByTestId('practice-bottom-dock-prev')).not.toBeDisabled();
  });

  it('submit disabled + aria-busy 当 isSubmitting=true', () => {
    render(<FbBottomDock {...baseProps} isSubmitting />);
    const submit = screen.getByTestId('practice-bottom-dock-submit');
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('clicking prev fires onPrev', async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();
    render(<FbBottomDock {...baseProps} onPrev={onPrev} />);
    await user.click(screen.getByTestId('practice-bottom-dock-prev'));
    expect(onPrev).toHaveBeenCalled();
  });

  it('clicking next fires onNext', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<FbBottomDock {...baseProps} onNext={onNext} />);
    await user.click(screen.getByTestId('practice-bottom-dock-next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('clicking open-drawer fires onOpenDrawer', async () => {
    const onOpenDrawer = vi.fn();
    const user = userEvent.setup();
    render(<FbBottomDock {...baseProps} onOpenDrawer={onOpenDrawer} />);
    await user.click(screen.getByTestId('practice-bottom-dock-open-drawer'));
    expect(onOpenDrawer).toHaveBeenCalled();
  });

  it('clicking submit fires onSubmit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FbBottomDock {...baseProps} onSubmit={onSubmit} />);
    await user.click(screen.getByTestId('practice-bottom-dock-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });

  // PR9 C2 (2026-05-13) — mobile branch verify: FbBottomDock 是 mobile +
  // tablet + desktop 三档共用 sticky 底栏, 不走 useDevice gate. 关键 mobile
  // 兼容点: (a) sticky bottom + z-50 (b) pb-safe iOS home indicator
  // (c) h-14=56px 触屏命中 ≥44 (d) px-4 mobile 紧凑.
  it('mobile-aware nav: sticky 底栏 + pb-safe + h-14 ≥44 触屏命中', () => {
    render(<FbBottomDock {...baseProps} />);
    const dock = screen.getByTestId('practice-bottom-dock');
    expect(dock).toHaveClass('sticky', 'bottom-0', 'z-50');
    expect(dock).toHaveClass('h-14', 'pb-safe');
    // mobile px-4 紧凑 + tablet+ px-6 切换
    expect(dock.className).toMatch(/px-4/);
    expect(dock.className).toMatch(/md:px-6/);
  });
});
