import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Rail } from '../Rail';

describe('Rail', () => {
  it('default renders <aside> with left border + sticky', () => {
    const { container } = render(<Rail data-testid="r">side</Rail>);
    const r = container.querySelector('[data-testid="r"]');
    expect(r).not.toBeNull();
    expect(r!.tagName).toBe('ASIDE');
    expect(r!).toHaveClass('border-r', 'border-line');
    expect(r!).toHaveClass('sticky', 'top-0', 'h-screen');
  });

  it('side="right" flips border to left edge', () => {
    const { container } = render(
      <Rail side="right" data-testid="r">
        side
      </Rail>,
    );
    const r = container.querySelector('[data-testid="r"]');
    expect(r).not.toBeNull();
    expect(r!).toHaveClass('border-l', 'border-line');
    expect(r!).not.toHaveClass('border-r');
  });

  it('sticky=false drops sticky classes (caller manages scroll)', () => {
    const { container } = render(
      <Rail sticky={false} data-testid="r">
        side
      </Rail>,
    );
    const r = container.querySelector('[data-testid="r"]');
    expect(r).not.toBeNull();
    expect(r!).not.toHaveClass('sticky');
    expect(r!).not.toHaveClass('h-screen');
  });

  it('as="nav" swaps element tag', () => {
    const { container } = render(
      <Rail as="nav" data-testid="r">
        side
      </Rail>,
    );
    const r = container.querySelector('[data-testid="r"]');
    expect(r).not.toBeNull();
    expect(r!.tagName).toBe('NAV');
  });

  it('passes className through (caller can extend padding etc.)', () => {
    const { container } = render(
      <Rail className="p-4" data-testid="r">
        x
      </Rail>,
    );
    const r = container.querySelector('[data-testid="r"]');
    expect(r).not.toBeNull();
    expect(r!).toHaveClass('p-4');
    // baseline still applied
    expect(r!).toHaveClass('bg-surface');
  });
});
