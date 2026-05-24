import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from './Section';

/*
 * Section tests — V5 D.3.33 container.
 * Why: cover the optional title (h3) + aria-labelledby wiring and the
 *      data-spacing token mapping. Pixel margin values flow through tokens
 *      (--space-3/4/5) which jsdom can't resolve, so the data-spacing attr
 *      is the test-stable contract.
 */

describe('Section', () => {
  it('renders <section> with default spacing="md" and no title', () => {
    render(
      <Section>
        <span>x</span>
      </Section>,
    );
    const root = screen.getByTestId('section');
    expect(root.tagName.toLowerCase()).toBe('section');
    expect(root).toHaveAttribute('data-spacing', 'md');
    expect(screen.queryByTestId('section-title')).toBeNull();
  });

  it('wires aria-labelledby to h3 when title is provided', () => {
    render(
      <Section title="本周练习">
        <span>x</span>
      </Section>,
    );
    const root = screen.getByTestId('section');
    const heading = screen.getByRole('heading', { level: 3, name: '本周练习' });
    expect(root).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('flips data-spacing across sm/md/lg variants', () => {
    const { rerender } = render(<Section spacing="sm"><span>x</span></Section>);
    expect(screen.getByTestId('section')).toHaveAttribute('data-spacing', 'sm');
    rerender(<Section spacing="lg"><span>x</span></Section>);
    expect(screen.getByTestId('section')).toHaveAttribute('data-spacing', 'lg');
  });
});
