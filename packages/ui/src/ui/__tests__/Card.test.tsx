import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('default variant renders bg-surface + shadow-card (Brand v2 PR1)', () => {
    const { container } = render(<Card data-testid="c">body</Card>);
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!).toHaveClass('bg-surface', 'shadow-card');
    expect(card!).toHaveClass('rounded-card-lg');
  });

  it('variant="ink" flips to ink bg + white text', () => {
    const { container } = render(
      <Card variant="ink" data-testid="c">
        body
      </Card>,
    );
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!).toHaveClass('bg-ink', 'text-white');
    expect(card!).not.toHaveClass('bg-surface');
  });

  it('variant="muted" (SIKAO Phase 1\') uses surface-alt + line border', () => {
    const { container } = render(
      <Card variant="muted" data-testid="c">
        body
      </Card>,
    );
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!).toHaveClass('bg-surface-alt');
    expect(card!).toHaveClass('border-line');
    expect(card!).toHaveClass('text-ink');
    // muted 不带 shadow-card (跟 default 区分: default 是浮起卡, muted 是分组容器)
    expect(card!).not.toHaveClass('shadow-card');
  });

  it('hoverable adds shadow-pop transition', () => {
    const { container } = render(
      <Card hoverable data-testid="c">
        body
      </Card>,
    );
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!).toHaveClass('hover:shadow-pop');
  });

  it('padding="lg" maps to p-6 md:p-8', () => {
    const { container } = render(
      <Card padding="lg" data-testid="c">
        body
      </Card>,
    );
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!).toHaveClass('p-6', 'md:p-8');
  });

  it('as="article" swaps element tag (semantic)', () => {
    const { container } = render(
      <Card as="article" data-testid="c">
        body
      </Card>,
    );
    const card = container.querySelector('[data-testid="c"]');
    expect(card).not.toBeNull();
    expect(card!.tagName).toBe('ARTICLE');
  });
});
