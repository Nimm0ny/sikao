import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from './Panel';

/*
 * Panel tests — V5 D.3.33 container.
 * Why: cover the title/no-title branching (sectioning + aria-labelledby vs
 *      plain div), the noPadding contract on the body, the danger variant
 *      attr, and the trailing slot mount point. data-* attrs are the test-
 *      stable surface; the pixel border color flows through tokens.css and
 *      is not resolvable in jsdom computed style.
 */

describe('Panel', () => {
  it('renders <section> with aria-labelledby when title is provided', () => {
    render(
      <Panel title="练习数据">
        <span>body</span>
      </Panel>,
    );
    const root = screen.getByTestId('panel');
    expect(root.tagName.toLowerCase()).toBe('section');
    const heading = screen.getByRole('heading', { level: 3, name: '练习数据' });
    expect(root).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('renders <div> with no aria-labelledby when title is absent', () => {
    render(
      <Panel>
        <span>body</span>
      </Panel>,
    );
    const root = screen.getByTestId('panel');
    expect(root.tagName.toLowerCase()).toBe('div');
    expect(root).not.toHaveAttribute('aria-labelledby');
  });

  it('exposes data-variant="danger" and renders trailing content', () => {
    render(
      <Panel title="风险" variant="danger" trailing={<button>关闭</button>}>
        <span>body</span>
      </Panel>,
    );
    expect(screen.getByTestId('panel')).toHaveAttribute('data-variant', 'danger');
    const trailing = screen.getByTestId('panel-trailing');
    expect(trailing).toContainElement(screen.getByRole('button', { name: '关闭' }));
  });

  it('toggles data-no-padding on body when noPadding is true', () => {
    const { rerender } = render(
      <Panel title="t">
        <span>x</span>
      </Panel>,
    );
    expect(screen.getByTestId('panel-body')).not.toHaveAttribute('data-no-padding');
    rerender(
      <Panel title="t" noPadding>
        <span>x</span>
      </Panel>,
    );
    expect(screen.getByTestId('panel-body')).toHaveAttribute('data-no-padding', 'true');
  });
});
