import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

/*
 * Pagination tests — V5 D.3.24 nav primitive (skeleton).
 * Why: cover render of compact mode pages, click → onChange, size changer
 *      Select trigger, jumper Enter trigger. We assert via aria-label on
 *      page buttons since each carries `第 N 页` for SR.
 */

describe('Pagination', () => {
  it('renders all pages 1..total when small total and no ellipsis', () => {
    render(
      <Pagination current={2} total={30} pageSize={10} onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 2 页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '第 3 页' })).toBeInTheDocument();
    // Active marker on current page.
    expect(screen.getByRole('button', { name: '第 2 页' })).toHaveAttribute('aria-current', 'page');
  });

  it('clicking a page button calls onChange with that page and current pageSize', () => {
    const onChange = vi.fn();
    render(
      <Pagination current={1} total={50} pageSize={10} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '第 3 页' }));
    expect(onChange).toHaveBeenCalledWith(3, 10);
  });

  it('showSizeChanger renders the size-changer Select with pageSize as value', () => {
    render(
      <Pagination
        current={1}
        total={500}
        pageSize={20}
        onChange={() => {}}
        showSizeChanger
      />,
    );
    expect(screen.getByTestId('pagination-size-changer')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '每页条数' })).toBeInTheDocument();
    expect(screen.getByText('20 条/页')).toBeInTheDocument();
  });

  it('showJumper input fires onChange(N, pageSize) on Enter', () => {
    const onChange = vi.fn();
    render(
      <Pagination
        current={1}
        total={1000}
        pageSize={10}
        onChange={onChange}
        showJumper
      />,
    );
    const input = screen.getByTestId('pagination-jumper-input');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(42, 10);
  });
});
