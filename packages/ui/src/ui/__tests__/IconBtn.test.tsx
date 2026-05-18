import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconBtn } from '../IconBtn';

describe('IconBtn', () => {
  it('renders default size (32×32) with aria-label and children svg slot', () => {
    render(
      <IconBtn aria-label="收藏">
        <svg data-testid="ic" />
      </IconBtn>,
    );
    const btn = screen.getByRole('button', { name: '收藏' });
    expect(btn).toHaveClass('w-8', 'h-8');
    expect(btn).toHaveClass('rounded-tiny');
    expect(screen.getByTestId('ic')).toBeInTheDocument();
  });

  it('size="md" maps to 40×40 (mobile touch)', () => {
    render(<IconBtn aria-label="设置" size="md">x</IconBtn>);
    const btn = screen.getByRole('button', { name: '设置' });
    expect(btn).toHaveClass('w-10', 'h-10');
  });

  it('variant="default" applies hover accent / active paper-3 classes', () => {
    render(<IconBtn aria-label="标记">x</IconBtn>);
    const btn = screen.getByRole('button', { name: '标记' });
    expect(btn).toHaveClass('hover:bg-accent-50');
    expect(btn).toHaveClass('active:bg-paper-3');
  });

  it('variant="on" shows selected state (accent-50 + accent stroke)', () => {
    render(<IconBtn aria-label="已收藏" variant="on">x</IconBtn>);
    const btn = screen.getByRole('button', { name: '已收藏' });
    expect(btn).toHaveClass('bg-accent-50');
    expect(btn).toHaveClass('text-accent');
  });

  it('variant="primary" maps to blue action + paper text', () => {
    render(<IconBtn aria-label="提交" variant="primary">x</IconBtn>);
    const btn = screen.getByRole('button', { name: '提交' });
    expect(btn).toHaveClass('bg-accent');
    expect(btn).toHaveClass('text-white');
  });

  it('default type is button (no implicit form submit)', () => {
    render(<IconBtn aria-label="x">x</IconBtn>);
    expect(screen.getByRole('button', { name: 'x' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('focus-visible ring uses accent token (a11y)', () => {
    render(<IconBtn aria-label="x">x</IconBtn>);
    const btn = screen.getByRole('button', { name: 'x' });
    expect(btn).toHaveClass('focus-visible:ring-accent');
    expect(btn).toHaveClass('focus-visible:ring-offset-2');
  });

  it('click delegates onClick to caller', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconBtn aria-label="收藏" onClick={onClick}>
        x
      </IconBtn>,
    );
    await user.click(screen.getByRole('button', { name: '收藏' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled prop blocks click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconBtn aria-label="x" onClick={onClick} disabled>
        x
      </IconBtn>,
    );
    await user.click(screen.getByRole('button', { name: 'x' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
