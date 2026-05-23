import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('exposes the variant + size as data-* attributes', () => {
    render(<Badge variant="ok">通过</Badge>);
    const el = screen.getByText('通过').parentElement as HTMLElement;
    expect(el.dataset.variant).toBe('ok');
    expect(el.dataset.size).toBe('md');
  });

  it('renders leading content when provided', () => {
    render(
      <Badge variant="brand" leading={<span data-testid="dot">★</span>}>
        热门
      </Badge>,
    );
    expect(screen.getByTestId('dot')).toBeInTheDocument();
  });

  it('respects sm size', () => {
    render(
      <Badge variant="cat-yanyu" size="sm">
        言语
      </Badge>,
    );
    const el = screen.getByText('言语').parentElement as HTMLElement;
    expect(el.dataset.size).toBe('sm');
    expect(el.dataset.variant).toBe('cat-yanyu');
  });
});
