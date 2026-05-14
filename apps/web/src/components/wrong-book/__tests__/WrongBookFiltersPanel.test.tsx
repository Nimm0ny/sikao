import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WrongBookFiltersPanel } from '../WrongBookFiltersPanel';

const SUMMARY = {
  inPractice: 287,
  todoCount: 84,
  dangerCount: 23,
  graduatedCount: 112,
  weeklyNew: 38,
};

describe('WrongBookFiltersPanel', () => {
  it('renders 7 chips with counts derived from summary', () => {
    render(
      <WrongBookFiltersPanel
        viewFilter="all"
        onChangeView={vi.fn()}
        summary={SUMMARY}
      />,
    );

    expect(screen.getByTestId('wrong-book-filters-panel')).toBeInTheDocument();
    for (const key of [
      'all',
      'todo',
      'doing',
      'danger',
      'meek',
      'ok',
      'new',
    ]) {
      expect(
        screen.getByTestId(`wrong-book-chip-${key}`),
      ).toBeInTheDocument();
    }
    expect(screen.getByTestId('wrong-book-chip-todo')).toHaveTextContent('84');
    expect(screen.getByTestId('wrong-book-chip-ok')).toHaveTextContent('112');
    expect(screen.getByTestId('wrong-book-chip-new')).toHaveTextContent('38');
  });

  it('active chip has aria-selected=true', () => {
    render(
      <WrongBookFiltersPanel
        viewFilter="danger"
        onChangeView={vi.fn()}
        summary={SUMMARY}
      />,
    );
    expect(screen.getByTestId('wrong-book-chip-danger')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('wrong-book-chip-all')).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('click chip → onChangeView called with that key', async () => {
    const onChangeView = vi.fn();
    const user = userEvent.setup();
    render(
      <WrongBookFiltersPanel
        viewFilter="all"
        onChangeView={onChangeView}
        summary={SUMMARY}
      />,
    );
    await user.click(screen.getByTestId('wrong-book-chip-danger'));
    expect(onChangeView).toHaveBeenCalledWith('danger');
  });
});
