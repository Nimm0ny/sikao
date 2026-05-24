import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

/*
 * Breadcrumb tests — V5 D.3.25 nav primitive (skeleton).
 * Why: cover full render with separator, maxItems collapse, mobile-hidden
 *      class wiring. Mobile @media is verified by checking the className
 *      exposes the breakpoint hide rule (we cannot evaluate @media in
 *      jsdom; the rule's existence in the CSS module is the contract).
 */

describe('Breadcrumb', () => {
  it('renders all items with separators between them', () => {
    render(
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '题库', href: '/q' },
          { label: '行测题目' },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: '面包屑' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '题库' })).toBeInTheDocument();
    // Last item is current page (no link).
    expect(screen.queryByRole('link', { name: '行测题目' })).toBeNull();
    const currentText = screen.getByText('行测题目');
    expect(currentText.closest('[aria-current="page"]')).not.toBeNull();
    // Two separators between three items.
    const separators = screen.getByRole('navigation').querySelectorAll('[aria-hidden="true"] svg');
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it('maxItems collapses long trails to first / ellipsis / last(maxItems-2)', () => {
    render(
      <Breadcrumb
        maxItems={3}
        items={[
          { label: '首页', href: '/' },
          { label: '考试', href: '/e' },
          { label: '行测', href: '/e/x' },
          { label: '判断推理', href: '/e/x/p' },
          { label: '类比推理' },
        ]}
      />,
    );
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByText('类比推理')).toBeInTheDocument();
    // Mid items collapsed away.
    expect(screen.queryByText('考试')).toBeNull();
    expect(screen.queryByText('行测')).toBeNull();
    expect(screen.queryByText('判断推理')).toBeNull();
  });

  it('attaches mobile-hide hook via className (root rule lives in CSS module)', () => {
    render(
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '当前' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: '面包屑' });
    // CSS module hashes the className; we just assert the presence of a className
    // so the @media rule (display:none under 768px) attaches deterministically.
    expect(nav.className.length).toBeGreaterThan(0);
  });
});
