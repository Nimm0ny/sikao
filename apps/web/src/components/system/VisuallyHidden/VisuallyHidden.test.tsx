import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders children for screen-reader consumers', () => {
    render(<VisuallyHidden>关闭对话框</VisuallyHidden>);
    expect(screen.getByText('关闭对话框')).toBeInTheDocument();
  });

  it('wraps content in a <span> for inline-friendly placement', () => {
    const { container } = render(<VisuallyHidden>label</VisuallyHidden>);
    const root = container.firstElementChild;
    expect(root?.tagName).toBe('SPAN');
  });

  it('applies the visually-hidden CSS module class (non-empty className)', () => {
    const { container } = render(<VisuallyHidden>x</VisuallyHidden>);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    // CSS Modules hash class names; assert a non-empty className is set.
    expect((span as HTMLElement).className.length).toBeGreaterThan(0);
  });
});
