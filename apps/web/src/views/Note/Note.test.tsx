import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Note } from './Note';

function renderNote() {
  return render(
    <MemoryRouter initialEntries={['/note']}>
      <Note />
    </MemoryRouter>,
  );
}

describe('Note view (D.4.3)', () => {
  it('renders the 3-row layout (header / FilterBar / SubBar / NotesGrid)', () => {
    renderNote();
    expect(screen.getByTestId('note-view')).toBeInTheDocument();
    expect(screen.getByTestId('note-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('note-sub-bar')).toBeInTheDocument();
    expect(screen.getByTestId('note-grid')).toBeInTheDocument();
  });

  it('FilterBar source chips toggle the active state via aria-pressed', () => {
    renderNote();
    const bar = screen.getByTestId('note-filter-bar');
    const free = within(bar).getByRole('button', { name: '自由' });
    expect(free.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(free);
    expect(free.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking a sticky note card opens the Drawer with side=right size=lg (R2/Q1: NOT Modal)', () => {
    renderNote();
    fireEvent.click(screen.getByTestId('note-card-n1'));
    const drawer = screen.getByTestId('drawer-panel');
    expect(drawer.dataset.side).toBe('right');
    expect(drawer.dataset.size).toBe('lg');
  });

  it('Note view does NOT render any Modal element (D.3.35 gotcha)', () => {
    renderNote();
    fireEvent.click(screen.getByTestId('note-card-n1'));
    // Modal would be tagged with data-testid="modal-panel" by the V5 Modal
    // skeleton; assert absence — Note must use Drawer.
    expect(screen.queryByTestId('modal-panel')).toBeNull();
  });

  it('cards expose the data-tilt attribute for the -2..+2 deg simulation', () => {
    renderNote();
    const cards = screen
      .getAllByRole('listitem')
      .filter((el) => el.getAttribute('data-testid')?.startsWith('note-card-'));
    for (const card of cards) {
      const tilt = card.dataset.tilt;
      expect(tilt).toBeDefined();
      expect(['-2', '-1', '0', '1', '2']).toContain(tilt);
    }
  });

  it('source chip filtering shrinks visible cards', () => {
    renderNote();
    const before = screen.getAllByRole('listitem').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('note-card-'),
    ).length;
    fireEvent.click(within(screen.getByTestId('note-filter-bar')).getByRole('button', { name: '错题反思' }));
    const after = screen.getAllByRole('listitem').filter((el) =>
      el.getAttribute('data-testid')?.startsWith('note-card-'),
    ).length;
    expect(after).toBeLessThan(before);
  });
});
