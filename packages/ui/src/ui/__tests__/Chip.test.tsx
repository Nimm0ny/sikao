import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from '../Chip';

describe('Chip', () => {
  it('renders children + button role with serif font + pill radius (spec §5)', () => {
    render(<Chip>分类</Chip>);
    const btn = screen.getByRole('button', { name: '分类' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('font-serif');
    expect(btn.className).toContain('rounded-pill');
  });

  it('default (unselected) uses paper-1 bg + line-3 border + ink-2 text', () => {
    render(<Chip>x</Chip>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-paper-1');
    expect(btn.className).toContain('border-line-3');
    expect(btn.className).toContain('text-ink-2');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('selected=true flips to blue action reverse (spec is-on)', () => {
    render(<Chip selected>x</Chip>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent');
    expect(btn.className).toContain('text-paper-1');
    expect(btn.className).toContain('border-accent');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-selected', 'true');
  });

  it('onClick delegated to caller', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Chip onClick={onClick}>x</Chip>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Chip onClick={onClick} disabled>
        x
      </Chip>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('size="sm" uses tiny font / tighter padding', () => {
    render(<Chip size="sm">x</Chip>);
    expect(screen.getByRole('button').className).toContain('text-tiny');
  });
});
