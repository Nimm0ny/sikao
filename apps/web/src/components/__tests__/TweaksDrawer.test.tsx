import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TweaksDrawer } from '@sikao/ui/ui/TweaksDrawer';

describe('TweaksDrawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-reading');
    document.documentElement.removeAttribute('data-nav');
    document.documentElement.removeAttribute('data-option');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('omits drawer content while closed', () => {
    render(<TweaksDrawer open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('阅读偏好')).not.toBeInTheDocument();
  });

  it('renders 5 toggle groups when open', () => {
    render(<TweaksDrawer open onClose={vi.fn()} />);
    expect(screen.getByText('主题')).toBeInTheDocument();
    expect(screen.getByText('密度')).toBeInTheDocument();
    expect(screen.getByText('阅读字号')).toBeInTheDocument();
    expect(screen.getByText('导航位置')).toBeInTheDocument();
    expect(screen.getByText('选项样式')).toBeInTheDocument();
  });

  it('clicking 夜读 sets data-theme="night"', async () => {
    const user = userEvent.setup();
    render(<TweaksDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '夜读' }));
    expect(document.documentElement.dataset.theme).toBe('night');
  });

  it('clicking 大字 sets data-reading="lg"', async () => {
    const user = userEvent.setup();
    render(<TweaksDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '大字' }));
    expect(document.documentElement.dataset.reading).toBe('lg');
  });

  it('reset button restores all defaults', async () => {
    const user = userEvent.setup();
    render(<TweaksDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '夜读' }));
    await user.click(screen.getByRole('radio', { name: '舒适' }));
    expect(document.documentElement.dataset.theme).toBe('night');
    expect(document.documentElement.dataset.density).toBe('cozy');

    await user.click(screen.getByTestId('tweaks-reset'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('selected radio gets aria-checked=true (a11y)', () => {
    render(<TweaksDrawer open onClose={vi.fn()} />);
    // default state.theme = reading
    expect(screen.getByRole('radio', { name: '纸读' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: '素白' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('close button delegates onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TweaksDrawer open onClose={onClose} />);
    await user.click(screen.getByTestId('side-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggling 选项样式 to 方形 sets data-option="square"', async () => {
    const user = userEvent.setup();
    render(<TweaksDrawer open onClose={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: '方形' }));
    expect(document.documentElement.dataset.option).toBe('square');
  });
});
