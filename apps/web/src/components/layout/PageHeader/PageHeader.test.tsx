import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

/*
 * PageHeader tests — V5 D.3.33 container.
 * Why: cover the optional slot mux (breadcrumb / actions / subtitle) and the
 *      semantic <header> + h1 landmark contract. axe / page-level a11y is
 *      validated downstream in V5-M9 page tests; here we just guard the
 *      DOM shape that page consumers depend on.
 */

describe('PageHeader', () => {
  it('renders title as h1 and wraps in <header>', () => {
    render(<PageHeader title="首页" />);
    const root = screen.getByTestId('page-header');
    expect(root.tagName.toLowerCase()).toBe('header');
    expect(screen.getByRole('heading', { level: 1, name: '首页' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-header-breadcrumb')).toBeNull();
    expect(screen.queryByTestId('page-header-actions')).toBeNull();
    expect(screen.queryByTestId('page-header-subtitle')).toBeNull();
  });

  it('renders breadcrumb / actions / subtitle when provided', () => {
    render(
      <PageHeader
        title="练习"
        subtitle="行测刷题，按真题套卷"
        breadcrumb={<nav data-testid="bc">面包屑</nav>}
        actions={<button>新建</button>}
      />,
    );
    expect(screen.getByTestId('page-header-breadcrumb')).toContainElement(
      screen.getByTestId('bc'),
    );
    expect(screen.getByTestId('page-header-actions')).toContainElement(
      screen.getByRole('button', { name: '新建' }),
    );
    expect(screen.getByTestId('page-header-subtitle')).toHaveTextContent(
      '行测刷题，按真题套卷',
    );
  });

  it('keeps breadcrumb / subtitle slots out of the tree when omitted', () => {
    render(<PageHeader title="题库" actions={<button>导入</button>} />);
    expect(screen.queryByTestId('page-header-breadcrumb')).toBeNull();
    expect(screen.queryByTestId('page-header-subtitle')).toBeNull();
    expect(screen.getByTestId('page-header-actions')).toBeInTheDocument();
  });
});
