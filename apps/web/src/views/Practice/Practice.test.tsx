import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Practice } from './Practice';

function renderPractice() {
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <Practice />
    </MemoryRouter>,
  );
}

describe('Practice view (D.4.2)', () => {
  it('renders the 4-row layout (header / row1 / specialty / paper)', () => {
    renderPractice();
    expect(screen.getByTestId('practice-view')).toBeInTheDocument();
    expect(screen.getByTestId('practice-quick-daily')).toBeInTheDocument();
    expect(screen.getByTestId('practice-quick-mock')).toBeInTheDocument();
    expect(screen.getByTestId('practice-specialty-grid')).toBeInTheDocument();
  });

  it('renders 4 quick-cards in row1 (每日一练 / 薄弱专项 / 真题模考 / 错题回顾)', () => {
    renderPractice();
    const cards = screen.getAllByRole('button').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('practice-quick-'),
    );
    expect(cards.length).toBe(4);
  });

  it('subtitle swaps when ScopeToggle flips between 行测 and 申论', () => {
    renderPractice();
    expect(screen.getByText('行测 · 5 大题型按专项纵切')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '申论' }));
    expect(screen.getByText('申论 · 4 类材料题 + 大作文')).toBeInTheDocument();
  });

  it('specialty grid swaps content when scope flips (xc → 4 行测 cats; sl → 4 申论 entries)', () => {
    renderPractice();
    const grid = screen.getByTestId('practice-specialty-grid');
    expect(within(grid).queryByTestId('practice-specialty-yy')).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '申论' }));
    const after = screen.getByTestId('practice-specialty-grid');
    expect(within(after).queryByTestId('practice-specialty-sl1')).not.toBeNull();
    expect(within(after).queryByTestId('practice-specialty-yy')).toBeNull();
  });

  it('renders 4 paper cards in the bottom panel', () => {
    renderPractice();
    const papers = screen
      .getAllByRole('article')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('practice-paper-'));
    expect(papers.length).toBe(4);
  });
});
