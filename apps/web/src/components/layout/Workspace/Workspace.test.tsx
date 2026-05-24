import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workspace } from './Workspace';

/*
 * Workspace tests — V5 D.3.32 layout.
 * Why: cover the data-max-width token mapping so future refactors of the CSS
 *      can't silently drop a content-shape variant. data-* attrs are the
 *      stable contract; pixel max-widths flow through tokens which jsdom
 *      cannot resolve in computed style.
 */

describe('Workspace', () => {
  it('applies data-max-width="workspace" by default and centers content', () => {
    render(<Workspace><span>x</span></Workspace>);
    const el = screen.getByText('x').parentElement;
    expect(el).toHaveAttribute('data-max-width', 'workspace');
    // role=main — semantic element
    expect(el?.tagName.toLowerCase()).toBe('main');
  });

  it('applies the requested data-max-width token', () => {
    const { rerender, getByText } = render(
      <Workspace maxWidth="reading"><span>r</span></Workspace>,
    );
    expect(getByText('r').parentElement).toHaveAttribute('data-max-width', 'reading');

    rerender(<Workspace maxWidth="form"><span>f</span></Workspace>);
    expect(getByText('f').parentElement).toHaveAttribute('data-max-width', 'form');

    rerender(<Workspace maxWidth="prose"><span>p</span></Workspace>);
    expect(getByText('p').parentElement).toHaveAttribute('data-max-width', 'prose');
  });

  it('passes data-max-width="none" so the CSS rule can drop max-width', () => {
    render(<Workspace maxWidth="none"><span>n</span></Workspace>);
    expect(screen.getByText('n').parentElement).toHaveAttribute('data-max-width', 'none');
  });
});
