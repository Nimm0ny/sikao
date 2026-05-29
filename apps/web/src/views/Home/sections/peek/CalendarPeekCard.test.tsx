import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlanStore } from '@sikao/domain';

import type { PlanEventReadV2 } from '@sikao/api-client/types/home';

const mutateAsyncMock = vi.fn();

vi.mock('@sikao/api-client/plansMutations', () => ({
  useUpdateEvent: (eventId: string | number) => ({
    mutateAsync: (payload: unknown) => mutateAsyncMock(eventId, payload),
  }),
}));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderWithPeek(
  event: PlanEventReadV2,
  list: ReadonlyArray<CalendarPeekListEntry>,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CalendarPeekProvider>
        <AutoOpen event={event} list={list} />
        <CalendarPeekCard />
      </CalendarPeekProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  usePlanStore.getState().resetOptimisticEvents();
  mutateAsyncMock.mockReset();
});

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

  it('Esc key closes the peek when idle', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('home-calendar-peek-card')).toBeNull();
  });

  it('scrim click closes the peek when idle', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);
    const overlay = screen.getByTestId('home-calendar-peek-overlay');
    fireEvent.click(overlay, { target: overlay, currentTarget: overlay });
    expect(screen.queryByTestId('home-calendar-peek-card')).toBeNull();
  });

  it('close button closes the peek when idle', () => {
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
    expect(document.body.style.overflow).not.toBe('hidden');
    unmount();
  });

  it('saves title inline with the real event id', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    mutateAsyncMock.mockResolvedValueOnce({ ...event, title: 'Renamed title' });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑标题' }));
    await user.clear(screen.getByLabelText('编辑标题'));
    await user.type(screen.getByLabelText('编辑标题'), 'Renamed title');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { title: 'Renamed title' });
    });
  });

  it('saves notes inline with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    mutateAsyncMock.mockResolvedValueOnce({ ...event, notes: 'Updated note' });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑备注' }));
    await user.clear(screen.getByLabelText('编辑备注'));
    await user.type(screen.getByLabelText('编辑备注'), 'Updated note');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { notes: 'Updated note' });
    });
  });

  it('disables the sibling edit trigger while one field is editing', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑标题' }));
    expect(screen.getByRole('button', { name: '编辑备注' })).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-prev')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-next')).toBeDisabled();
  });

  it('does not save title while IME composition is active', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑标题' }));
    const input = screen.getByLabelText('编辑标题');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('rolls back title after a failed save and stays in editing state', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { title: 'Original title' });
    mutateAsyncMock.mockRejectedValueOnce(new Error('boom'));
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑标题' }));
    await user.clear(screen.getByLabelText('编辑标题'));
    await user.type(screen.getByLabelText('编辑标题'), 'Broken title');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByLabelText('编辑标题')).toHaveValue('Original title');
    });
    expect(screen.getByText('保存失败，请重试')).toBeInTheDocument();
  });

  it('disables head navigation while saving', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    let resolveSave: (() => void) | null = null;
    mutateAsyncMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByRole('button', { name: '编辑标题' }));
    await user.type(screen.getByLabelText('编辑标题'), ' X');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('home-calendar-peek-close')).toBeDisabled();
      expect(screen.getByTestId('home-calendar-peek-prev')).toBeDisabled();
      expect(screen.getByTestId('home-calendar-peek-next')).toBeDisabled();
    });

    resolveSave?.();
    await waitFor(() => {
      expect(screen.getByTestId('home-calendar-peek-close')).toBeEnabled();
    });
  });
});
