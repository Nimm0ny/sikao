import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Review } from './Review';

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <Review />
    </MemoryRouter>,
  );
}

describe('Review view (D.4.5 + 复习日历)', () => {
  it('renders the 4-row layout (header / FilterBar / Calendar bar / grid)', () => {
    renderReview();
    expect(screen.getByTestId('review-view')).toBeInTheDocument();
    expect(screen.getByTestId('review-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('review-calendar-bar')).toBeInTheDocument();
    expect(screen.getByTestId('review-grid')).toBeInTheDocument();
  });

  it('renders DatePicker with default presets (今天 / 明天 / 下周一)', () => {
    renderReview();
    const trigger = screen.getByRole('button', { name: '复习日' });
    fireEvent.click(trigger);
    const panel = screen.getByTestId('datepicker-panel');
    expect(within(panel).getByRole('button', { name: '今天' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '明天' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '下周一' })).toBeInTheDocument();
  });

  it('compact-grid renders cards with --card-radius-sm density (matches Hub: 3 cols on desktop)', () => {
    renderReview();
    const grid = screen.getByTestId('review-grid');
    const cards = within(grid).getAllByRole('listitem');
    // PAGE_SIZE = 9 — first page renders 9 review cards.
    expect(cards.length).toBe(9);
  });

  it('overdue cards mark dueLabel via [data-overdue=true]', () => {
    renderReview();
    const grid = screen.getByTestId('review-grid');
    const overdueLabels = grid.querySelectorAll('[data-overdue="true"]');
    expect(overdueLabels.length).toBeGreaterThan(0);
  });

  it('chip click toggles aria-pressed for the active mistake-state filter', () => {
    renderReview();
    const overdueChip = screen.getByRole('button', { name: '逾期' });
    expect(overdueChip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(overdueChip);
    expect(overdueChip.getAttribute('aria-pressed')).toBe('true');
  });
});
