import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('default chip variant renders neutral tone', () => {
    render(<Badge>单选题</Badge>);
    const el = screen.getByText('单选题');
    expect(el).toHaveClass('bg-surface-alt', 'border-line', 'text-ink-3');
    expect(el).toHaveClass('rounded-tiny');
  });

  it('tone="success" applies success tokens', () => {
    render(<Badge tone="success">完成</Badge>);
    const el = screen.getByText('完成');
    expect(el).toHaveClass('bg-ok-bg', 'border-ok', 'text-ok');
  });

  it('SIKAO Phase 1\': tone="accent" 暗朱 chip', () => {
    render(<Badge tone="accent">当前</Badge>);
    const el = screen.getByText('当前');
    expect(el).toHaveClass('bg-accent-50', 'border-accent', 'text-accent');
  });

  it('SIKAO Phase 1\': active=true overrides tone with ink-reverse (white on ink)', () => {
    render(
      <Badge tone="accent" active>
        当前
      </Badge>,
    );
    const el = screen.getByText('当前');
    // active class 包覆盖 tone 的 bg/border/text
    expect(el).toHaveClass('bg-ink', 'border-ink', 'text-white');
    expect(el).toHaveAttribute('data-active');
    // accent token classes 不应同时出现 (override 干净)
    expect(el).not.toHaveClass('bg-accent-50');
    expect(el).not.toHaveClass('text-accent');
  });

  it('active=false omits data-active attribute', () => {
    render(<Badge tone="success">完成</Badge>);
    const el = screen.getByText('完成');
    expect(el).not.toHaveAttribute('data-active');
  });

  it('dot=true renders aria-hidden dot with tone color', () => {
    const { container } = render(
      <Badge tone="success" dot>
        完成
      </Badge>,
    );
    const dot = container.querySelector('[data-pattern="dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass('bg-ok', 'rounded-pill');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('dot color flips to white when active=true', () => {
    const { container } = render(
      <Badge tone="success" dot active>
        完成
      </Badge>,
    );
    const dot = container.querySelector('[data-pattern="dot"]');
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass('bg-white');
    expect(dot).not.toHaveClass('bg-ok');
  });

  it('variant="hairline" uses border + transparent bg', () => {
    render(
      <Badge variant="hairline" tone="brand">
        45
      </Badge>,
    );
    const el = screen.getByText('45');
    expect(el).toHaveClass('border-ink', 'text-ink', 'bg-transparent');
  });
});
