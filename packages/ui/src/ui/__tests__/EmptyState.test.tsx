import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('default tone="muted": role=status, dashed line border, data-tone=muted', () => {
    render(<EmptyState title="暂无错题" description="继续保持。" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('暂无错题');
    expect(el).toHaveTextContent('继续保持。');
    expect(el).toHaveAttribute('data-tone', 'muted');
    expect(el).toHaveClass('border-dashed', 'border-line');
    expect(el).not.toHaveClass('border-err');
  });

  it('tone="error": role=alert, solid danger border, data-tone=error', () => {
    render(<EmptyState tone="error" title="加载失败" description="检查网络后重试。" />);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('data-tone', 'error');
    expect(el).toHaveClass('border-err');
    expect(el).not.toHaveClass('border-dashed');
    expect(el).not.toHaveClass('border-line');
    expect(el).toHaveTextContent('加载失败');
    expect(el).toHaveTextContent('检查网络后重试。');
  });

  it('icon container uses placeholder color in default tone', () => {
    render(<EmptyState title="x" icon={<span data-testid="ic" />} />);
    const iconBox = screen.getByTestId('ic').parentElement;
    expect(iconBox).not.toBeNull();
    expect(iconBox!).toHaveClass('text-ink-4');
    expect(iconBox!).not.toHaveClass('text-err');
  });

  it('icon container uses danger color when tone="error"', () => {
    render(<EmptyState tone="error" title="x" icon={<span data-testid="ic" />} />);
    const iconBox = screen.getByTestId('ic').parentElement;
    expect(iconBox).not.toBeNull();
    expect(iconBox!).toHaveClass('text-err');
    expect(iconBox!).not.toHaveClass('text-ink-4');
  });

  it('action slot renders and click is delegated', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="x" action={<button onClick={onClick}>重试</button>} />);
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('description is omitted from DOM when not provided', () => {
    render(<EmptyState title="只有标题" />);
    expect(screen.queryByText(/检查网络/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('只有标题');
  });
});
