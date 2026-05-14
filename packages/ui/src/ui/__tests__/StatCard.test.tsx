import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders label + value with serif tabular-nums (spec §5)', () => {
    render(<StatCard label="累计题数" value={1234} />);
    const value = screen.getByText('1234');
    expect(value).toBeInTheDocument();
    expect(value.className).toContain('font-serif');
    expect(value.className).toContain('tabular-nums');
    expect(value.className).toContain('text-ink-1');
  });

  it('renders unit as serif italic ink-3', () => {
    render(<StatCard label="正确率" value="87" unit="%" />);
    const unit = screen.getByText('%');
    expect(unit).toBeInTheDocument();
    expect(unit.className).toContain('font-serif');
    expect(unit.className).toContain('italic');
    expect(unit.className).toContain('text-ink-3');
  });

  it('delta.up uses ok semantic color + up glyph', () => {
    render(
      <StatCard
        label="x"
        value={1}
        delta={{ value: '比昨天 +4', direction: 'up' }}
      />,
    );
    const delta = screen.getByText('比昨天 +4');
    expect(delta.className).toContain('text-ok');
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('delta.down uses err semantic color + down glyph', () => {
    render(
      <StatCard
        label="x"
        value={1}
        delta={{ value: '比昨天 -2', direction: 'down' }}
      />,
    );
    const delta = screen.getByText('比昨天 -2');
    expect(delta.className).toContain('text-err');
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('delta.flat uses ink-3 placeholder + em-dash glyph', () => {
    render(
      <StatCard label="x" value={1} delta={{ value: '持平', direction: 'flat' }} />,
    );
    const delta = screen.getByText('持平');
    expect(delta.className).toContain('text-ink-3');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('uses paper-1 bg + line-2 border + r-card radius (spec §5)', () => {
    const { container } = render(<StatCard label="x" value={1} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('bg-paper-1');
    expect(root.className).toContain('border-line-2');
    expect(root.className).toContain('rounded-card');
  });

  it('size="sm" uses 2xl value + tighter padding', () => {
    const { container } = render(<StatCard label="x" value={1} size="sm" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('px-3');
    const value = screen.getByText('1');
    expect(value.className).toContain('text-2xl');
  });
});
