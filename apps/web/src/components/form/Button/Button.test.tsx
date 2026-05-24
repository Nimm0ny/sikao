import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import type { ButtonSize, ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'tertiary', 'ghost', 'danger'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg', 'xl'];

describe('Button', () => {
  it('renders the variant × size matrix via data-* attrs', () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        const { unmount } = render(
          <Button variant={variant} size={size}>
            标签
          </Button>,
        );
        const btn = screen.getByRole('button', { name: '标签' });
        expect(btn.dataset.variant).toBe(variant);
        expect(btn.dataset.size).toBe(size);
        unmount();
      }
    }
  });

  it('renders a spinner and blocks onClick when loading=true', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        提交中
      </Button>,
    );
    const btn = screen.getByRole('button', { name: '提交中' });
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('blocks onClick and renders disabled when disabled=true', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        不可点
      </Button>,
    );
    const btn = screen.getByRole('button', { name: '不可点' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('throws fail-fast when iconOnly + children are passed together', () => {
    const icon = <svg data-testid="x" viewBox="0 0 24 24" />;
    // suppress React error boundary noise — we only assert the throw
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Button variant="ghost" iconOnly={icon} aria-label="关闭">
          子节点
        </Button>,
      ),
    ).toThrow(/iconOnly.*mutually exclusive/);
    errSpy.mockRestore();
  });

  it('throws fail-fast when iconOnly is missing aria-label, accepts when provided', () => {
    const icon = <svg data-testid="x" viewBox="0 0 24 24" />;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Button variant="ghost" iconOnly={icon} />)).toThrow(/aria-label/);
    errSpy.mockRestore();
    render(<Button variant="ghost" iconOnly={icon} aria-label="关闭" />);
    const btn = screen.getByRole('button', { name: '关闭' });
    expect(btn.dataset.iconOnly).toBe('true');
  });
});
