import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Divider } from './Divider';

describe('Divider', () => {
  it('defaults to horizontal/default/no-inset', () => {
    const { container } = render(<Divider />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.dataset.orientation).toBe('horizontal');
    expect(el.dataset.variant).toBe('default');
    expect(el.dataset.inset).toBe('false');
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('renders vertical orientation with strong variant', () => {
    const { container } = render(<Divider orientation="vertical" variant="strong" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.orientation).toBe('vertical');
    expect(el.dataset.variant).toBe('strong');
    // class list should include the vertical + strong-variant module classes.
    expect(el.className).toMatch(/vertical/);
    expect(el.className).toMatch(/variant-strong/);
  });

  it('applies inset only when orientation=horizontal', () => {
    const { container: hc } = render(<Divider inset variant="subtle" />);
    expect((hc.firstElementChild as HTMLElement).dataset.inset).toBe('true');
    expect((hc.firstElementChild as HTMLElement).className).toMatch(/inset/);

    const { container: vc } = render(<Divider orientation="vertical" inset />);
    // data-inset reflects the prop (so ConfirmDialog can audit), but the
    // module class must NOT be applied for vertical (per spec D.3.34).
    expect((vc.firstElementChild as HTMLElement).className).not.toMatch(/\binset\b/);
  });
});
