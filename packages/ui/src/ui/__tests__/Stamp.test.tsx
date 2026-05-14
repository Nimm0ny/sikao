import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stamp } from '../Stamp';

describe('Stamp', () => {
  it('renders mono uppercase with eyebrow size + tracking-widest', () => {
    render(<Stamp>SIKAO · 2024</Stamp>);
    const el = screen.getByText('SIKAO · 2024');
    // 父 span (Stamp 容器) 的 className
    const stamp = el.parentElement;
    expect(stamp).not.toBeNull();
    expect(stamp!).toHaveClass('font-mono', 'text-tiny', 'uppercase');
    expect(stamp!).toHaveClass('tracking-widest');
  });

  it('renders accent dot by default (ø6px, accent token)', () => {
    const { container } = render(<Stamp>x</Stamp>);
    const dot = container.querySelector('[data-pattern="dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass('bg-accent');
    expect(dot).toHaveClass('rounded-pill');
  });

  it('omits dot when dot=false', () => {
    const { container } = render(<Stamp dot={false}>x</Stamp>);
    expect(container.querySelector('[data-pattern="dot"]')).toBeNull();
  });

  it('applies custom className passthrough', () => {
    render(<Stamp className="ml-4">x</Stamp>);
    const stamp = screen.getByText('x').parentElement;
    expect(stamp).not.toBeNull();
    expect(stamp!).toHaveClass('ml-4');
  });
});
