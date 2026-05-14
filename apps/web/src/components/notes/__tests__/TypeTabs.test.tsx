import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TypeTabs } from '../TypeTabs';

describe('TypeTabs', () => {
  it('5 等分 tab + active aria-selected', () => {
    render(
      <TypeTabs
        value="quote"
        counts={{ all: 10, quote: 4, method: 2, reflect: 3, material: 1 }}
        onChange={() => {}}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    const quote = screen.getByTestId('notes-type-tab-quote');
    expect(quote).toHaveAttribute('aria-selected', 'true');
  });

  it('点击触发 onChange + 传入 next value', () => {
    const handle = vi.fn();
    render(
      <TypeTabs
        value="all"
        counts={{ all: 10, quote: 4 }}
        onChange={handle}
      />,
    );
    fireEvent.click(screen.getByTestId('notes-type-tab-quote'));
    expect(handle).toHaveBeenCalledWith('quote');
  });

  it('counts 渲染到对应 tab', () => {
    render(
      <TypeTabs
        value="all"
        counts={{ all: 99, method: 7 }}
        onChange={() => {}}
      />,
    );
    const methodTab = screen.getByTestId('notes-type-tab-method');
    expect(methodTab).toHaveTextContent('7');
    const allTab = screen.getByTestId('notes-type-tab-all');
    expect(allTab).toHaveTextContent('99');
  });
});
