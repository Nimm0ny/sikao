import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill } from '../Pill';

describe('Pill', () => {
  it('renders children + pill radius + serif italic (spec §5)', () => {
    render(<Pill>v1.0</Pill>);
    const el = screen.getByText('v1.0');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('rounded-pill');
    expect(el.className).toContain('font-serif');
    expect(el.className).toContain('italic');
  });

  it('tone="default" uses ink-3 text + line-3 border', () => {
    render(<Pill>x</Pill>);
    const el = screen.getByText('x');
    expect(el.className).toContain('text-ink-3');
    expect(el.className).toContain('border-line-3');
  });

  it('tone="ok" maps to ok semantic color', () => {
    render(<Pill tone="ok">通过</Pill>);
    const el = screen.getByText('通过');
    expect(el.className).toContain('text-ok');
    expect(el.className).toContain('border-ok');
  });

  it('tone="warn" maps to warn semantic color', () => {
    render(<Pill tone="warn">注意</Pill>);
    const el = screen.getByText('注意');
    expect(el.className).toContain('text-warn');
    expect(el.className).toContain('border-warn');
  });

  it('tone="err" maps to err semantic color', () => {
    render(<Pill tone="err">失败</Pill>);
    const el = screen.getByText('失败');
    expect(el.className).toContain('text-err');
    expect(el.className).toContain('border-err');
  });

  it('tone="ink" reverses to ink bg + paper text', () => {
    render(<Pill tone="ink">ink</Pill>);
    const el = screen.getByText('ink');
    expect(el.className).toContain('bg-ink-1');
    expect(el.className).toContain('text-paper-1');
  });

  it('icon slot renders before children', () => {
    render(
      <Pill icon={<span data-testid="dot">●</span>}>label</Pill>,
    );
    expect(screen.getByTestId('dot')).toBeInTheDocument();
    expect(screen.getByText('label')).toBeInTheDocument();
  });
});
