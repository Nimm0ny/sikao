/*
 * CalendarPeekCard.test.tsx — SIK-138 W6.
 *
 * Why: visual contract §2 + Requirement 12 lock the read-only peek
 *      surface contract:
 *        - 6 head buttons (4 disabled placeholders, prev / next / close
 *          functional)
 *        - 8-row property table
 *        - notes section + read-only banner
 *        - Esc / scrim / close button each close
 *        - ArrowUp / ArrowDown walk inside list scope
 *        - portal-mounted (DOM escapes the consumer subtree)
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

import { CalendarPeekProvider } from './CalendarPeekProvider';
import { CalendarPeekCard } from './CalendarPeekCard';
import { useCalendarPeek } from './useCalendarPeek';
import type { CalendarPeekListEntry } from './types';

function makeEvent(id: string, overrides: Partial<PlanEventReadV2> = {}): PlanEventReadV2 {
  return {
    id,
    title: `Event ${id}`,
    startAt: '2026-05-26T08:00:00+08:00',
    endAt: '2026-05-26T09:30:00+08:00',
    category: 'practice',
    status: 'in_progress',
    source: 'ai',
    timezone: 'Asia/Shanghai',
    notes: '关注主旨题与意图题判断词。',
    planId: 1,
    isRecurringInstance: false,
    deletedAt: null,
    linkedSessionId: 'sess-1',
    parentId: null,
    recurringExceptionDates: [],
    recurringParentId: null,
    recurringRule: null,
    targetId: 'tgt-1',
    ...overrides,
  } as PlanEventReadV2;
}

interface AutoOpenProps {
  readonly event: PlanEventReadV2;
  readonly list: ReadonlyArray<CalendarPeekListEntry>;
}

function AutoOpen({ event, list }: AutoOpenProps) {
  const peek = useCalendarPeek();
  useEffect(() => {
    peek.open(event, list);
    // open is stable per provider (useCallback), exhaustive-deps satisfied
    // by intentional one-shot effect — re-runs would re-open on every key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderWithPeek(
  event: PlanEventReadV2,
  list: ReadonlyArray<CalendarPeekListEntry>,
) {
  return render(
    <CalendarPeekProvider>
      <AutoOpen event={event} list={list} />
      <CalendarPeekCard />
    </CalendarPeekProvider>,
  );
}

describe('CalendarPeekCard', () => {
  it('renders into a portal escaping the consumer subtree', () => {
    const event = makeEvent('e1');
    const { container } = renderWithPeek(event, [{ id: 'e1', event }]);
    expect(container.querySelector('[data-testid="home-calendar-peek-card"]')).toBeNull();
    expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument();
  });

  it('renders all six head buttons with placeholder disabled state', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    expect(screen.getByTestId('home-calendar-peek-expand')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-copy')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-more')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-close')).toBeEnabled();
    // prev / next exist but are disabled when list has a single entry
    expect(screen.getByTestId('home-calendar-peek-prev')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-next')).toBeDisabled();
  });

  it('renders the eight property rows + notes section + banner', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    const expectedTestIds = [
      'home-calendar-peek-time',
      'home-calendar-peek-kind',
      'home-calendar-peek-category',
      'home-calendar-peek-status',
      'home-calendar-peek-source',
      'home-calendar-peek-linked',
      'home-calendar-peek-target',
      'home-calendar-peek-recurring',
    ];
    for (const id of expectedTestIds) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId('home-calendar-peek-notes')).toHaveTextContent('关注主旨题');
    expect(screen.getByTestId('home-calendar-peek-readonly-banner')).toBeInTheDocument();
  });

  it('falls back to the empty notes cue when notes is blank', () => {
    const event = makeEvent('e1', { notes: '' });
    renderWithPeek(event, [{ id: 'e1', event }]);
    expect(screen.getByTestId('home-calendar-peek-notes-empty')).toHaveTextContent('暂无备注');
  });

  it('Esc key closes the peek', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('home-calendar-peek-card')).toBeNull();
  });

  it('scrim click closes the peek', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    const overlay = screen.getByTestId('home-calendar-peek-overlay');
    fireEvent.click(overlay, { target: overlay, currentTarget: overlay });
    expect(screen.queryByTestId('home-calendar-peek-card')).toBeNull();
  });

  it('close button closes the peek', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    fireEvent.click(screen.getByTestId('home-calendar-peek-close'));
    expect(screen.queryByTestId('home-calendar-peek-card')).toBeNull();
  });

  it('ArrowDown / ArrowUp walk the list scope', () => {
    const list: CalendarPeekListEntry[] = [
      { id: 'a', event: makeEvent('a', { title: '事件 A' }) },
      { id: 'b', event: makeEvent('b', { title: '事件 B' }) },
      { id: 'c', event: makeEvent('c', { title: '事件 C' }) },
    ];
    renderWithPeek(list[0].event, list);
    expect(screen.getByText('事件 A')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByText('事件 B')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByText('事件 C')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByText('事件 B')).toBeInTheDocument();
  });

  it('locks body scroll while open and restores it on close', () => {
    const event = makeEvent('e1');
    const { unmount } = renderWithPeek(event, [{ id: 'e1', event }]);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    // After close the lock should release; body.style.overflow is reset
    // to whatever it was prior (empty string in jsdom default).
    expect(document.body.style.overflow).not.toBe('hidden');
    unmount();
  });
});
