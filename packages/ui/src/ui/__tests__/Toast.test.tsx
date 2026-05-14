import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  it('renders children + role=status + dot (spec §5)', () => {
    render(<Toast>保存成功</Toast>);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('保存成功');
    const dot = status.querySelector('[data-pattern="dot"]');
    expect(dot).not.toBeNull();
  });

  it('uses ink-1 bg + paper-1 text + r-tiny radius + shadow-pop (spec §5)', () => {
    const { container } = render(<Toast>x</Toast>);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-ink-1');
    expect(root.className).toContain('text-paper-1');
    expect(root.className).toContain('rounded-tiny');
    expect(root.className).toContain('shadow-pop');
  });

  it('default tone uses accent-2 dot', () => {
    const { container } = render(<Toast>x</Toast>);
    const dot = container.querySelector('[data-pattern="dot"]') as HTMLElement;
    expect(dot.className).toContain('bg-accent-2');
  });

  it('tone="ok" uses ok dot', () => {
    const { container } = render(<Toast tone="ok">x</Toast>);
    const dot = container.querySelector('[data-pattern="dot"]') as HTMLElement;
    expect(dot.className).toContain('bg-ok');
  });

  it('tone="err" uses err dot', () => {
    const { container } = render(<Toast tone="err">x</Toast>);
    const dot = container.querySelector('[data-pattern="dot"]') as HTMLElement;
    expect(dot.className).toContain('bg-err');
  });

  it('tone="warn" uses warn dot', () => {
    const { container } = render(<Toast tone="warn">x</Toast>);
    const dot = container.querySelector('[data-pattern="dot"]') as HTMLElement;
    expect(dot.className).toContain('bg-warn');
  });
});
