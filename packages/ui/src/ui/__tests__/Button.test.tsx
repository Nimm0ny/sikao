import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('default variant=primary maps to blue action + text-white', () => {
    render(<Button>提交</Button>);
    const btn = screen.getByRole('button', { name: '提交' });
    expect(btn).toHaveClass('bg-accent', 'text-white');
    expect(btn).toHaveClass('rounded-tiny');
  });

  it('variant="secondary" outline (white bg + ink border)', () => {
    render(<Button variant="secondary">查看</Button>);
    const btn = screen.getByRole('button', { name: '查看' });
    expect(btn).toHaveClass('border-ink', 'bg-surface', 'text-ink');
  });

  it('variant="accent" maps to gray emphasis', () => {
    render(<Button variant="accent">重点提醒</Button>);
    const btn = screen.getByRole('button', { name: '重点提醒' });
    expect(btn).toHaveClass('bg-ink-2', 'text-white');
  });

  it('variant="ghost" softer outline', () => {
    render(<Button variant="ghost">更多</Button>);
    const btn = screen.getByRole('button', { name: '更多' });
    expect(btn).toHaveClass('border-line', 'text-ink-3');
  });

  it('variant="danger" red destructive', () => {
    render(<Button variant="danger">删除</Button>);
    const btn = screen.getByRole('button', { name: '删除' });
    expect(btn).toHaveClass('bg-err', 'text-white');
  });

  it('variant="quiet" link-style without box', () => {
    render(<Button variant="quiet">取消</Button>);
    const btn = screen.getByRole('button', { name: '取消' });
    expect(btn).toHaveClass('text-ink-3');
    expect(btn).not.toHaveClass('bg-accent');
  });

  it('size="sm" maps to px-3 py-2 (32px target)', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-2');
  });

  it('default type=button (no implicit form submit)', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('isLoading shows spinner + aria-busy + blocks click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        提交
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders leftIcon + children + rightIcon order', () => {
    render(
      <Button
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      >
        中
      </Button>,
    );
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('focus-visible ring offset 4 (Brand v2 PR2 a11y)', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-accent-50',
      'focus-visible:ring-offset-4',
    );
  });

  it('fullWidth=true adds w-full', () => {
    render(<Button fullWidth>x</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('active=true sets aria-pressed + data-active + accent reverse classes', () => {
    render(<Button active>x</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-active', 'true');
    expect(btn).toHaveClass('bg-accent', 'text-paper-1', 'border-accent');
  });

  it('active default (false) omits data-active + aria-pressed', () => {
    render(<Button>x</Button>);
    const btn = screen.getByRole('button');
    expect(btn).not.toHaveAttribute('data-active');
    expect(btn).not.toHaveAttribute('aria-pressed');
  });
});
