import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuestionHub } from './QuestionHub';

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/question-hub']}>
      <QuestionHub />
    </MemoryRouter>,
  );
}

describe('Question Hub view (D.4.5)', () => {
  it('renders the 3-row layout (header / FilterBar / grid)', () => {
    renderHub();
    expect(screen.getByTestId('question-hub-view')).toBeInTheDocument();
    expect(screen.getByTestId('hub-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('hub-grid')).toBeInTheDocument();
  });

  it('renders 3 chip groups (科目 / 题型 / 错题状态)', () => {
    renderHub();
    const bar = screen.getByTestId('hub-filter-bar');
    expect(within(bar).getByLabelText('科目')).toBeInTheDocument();
    expect(within(bar).getByLabelText('题型')).toBeInTheDocument();
    expect(within(bar).getByLabelText('错题状态')).toBeInTheDocument();
  });

  it('compact-grid renders cards with --card-radius-sm density (3 cols on desktop)', () => {
    renderHub();
    const grid = screen.getByTestId('hub-grid');
    // Every card has [data-testid^="hub-card-"]; first 12 are visible per
    // page (PAGE_SIZE = 12).
    const cards = within(grid).getAllByRole('listitem');
    expect(cards.length).toBe(12);
  });

  it('chip click toggles aria-pressed for the active filter', () => {
    renderHub();
    const xc = screen.getByRole('button', { name: '行测' });
    expect(xc.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(xc);
    expect(xc.getAttribute('aria-pressed')).toBe('true');
  });

  it('Pagination renders in compact (size=sm) trailing slot', () => {
    renderHub();
    const trailing = screen.getByTestId('panel-trailing');
    const nav = within(trailing).getByRole('navigation', { name: 'Pagination' });
    expect(nav.dataset.size).toBe('sm');
  });
});
