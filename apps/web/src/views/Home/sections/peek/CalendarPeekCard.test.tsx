import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePlanStore } from '@sikao/domain';
import axe from 'axe-core';

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

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    'color-contrast': { enabled: false },
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
  },
};

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
    notes: 'Focus on main idea and intent clues.',
    planId: 1,
    isRecurringInstance: false,
    deletedAt: null,
    linkedSessionId: 17,
    parentId: null,
    recurringExceptionDates: [],
    recurringParentId: null,
    recurringRule: null,
    targetId: 23,
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

function renderWithPeek(event: PlanEventReadV2, list: ReadonlyArray<CalendarPeekListEntry>) {
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

  it('renders the eight property rows + notes section without a static banner in W3', () => {
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    for (const testId of [
      'home-calendar-peek-time',
      'home-calendar-peek-kind',
      'home-calendar-peek-category',
      'home-calendar-peek-status',
      'home-calendar-peek-source',
      'home-calendar-peek-linked',
      'home-calendar-peek-target',
      'home-calendar-peek-recurring',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }

    expect(screen.getByTestId('home-calendar-peek-notes')).toHaveTextContent('Focus on main idea');
    expect(screen.queryByTestId('home-calendar-peek-readonly-banner')).toBeNull();
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
      { id: 'a', event: makeEvent('a', { title: 'Event A' }) },
      { id: 'b', event: makeEvent('b', { title: 'Event B' }) },
      { id: 'c', event: makeEvent('c', { title: 'Event C' }) },
    ];

    renderWithPeek(list[0].event, list);
    expect(screen.getByText('Event A')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByText('Event B')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByText('Event C')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByText('Event B')).toBeInTheDocument();
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

    await user.click(screen.getByTitle('edit-title'));
    const input = within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Renamed title');
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

    await user.click(screen.getByTitle('edit-notes'));
    const textarea = within(screen.getByTestId('home-calendar-peek-notes-editor')).getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Updated note');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { notes: 'Updated note' });
    });
  });

  it('disables the sibling edit trigger while one field is editing', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-title'));
    expect(screen.getByTitle('edit-notes')).toBeDisabled();
    expect(screen.getByTitle('edit-status')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-prev')).toBeDisabled();
    expect(screen.getByTestId('home-calendar-peek-next')).toBeDisabled();
  });

  it('does not save title while IME composition is active', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-title'));
    const input = within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('rolls back title after a failed save and stays in editing state', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { title: 'Original title' });
    mutateAsyncMock.mockRejectedValueOnce(new Error('boom'));
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-title'));
    const input = within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Broken title');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox')).toHaveValue('Original title');
    });
    expect(screen.getByText('保存失败，请重试')).toBeInTheDocument();
  });

  it('saves status inline with the real event id', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    mutateAsyncMock.mockResolvedValueOnce({ ...event, status: 'done' });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));
    const editor = screen.getByTestId('home-calendar-peek-status-editor');
    await user.click(within(editor).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '已完成' }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { status: 'done' });
    });
  });

  it('focuses the prop editor combobox when entering edit mode', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));
    expect(within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('combobox')).toHaveFocus();
  });

  it('saves a prop editor with keyboard-only ArrowDown + Enter', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    mutateAsyncMock.mockResolvedValueOnce({ ...event, status: 'done' });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));
    const combo = within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('combobox');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { status: 'done' });
    });
  });

  it('cancels a prop editor on Escape without closing the peek', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));
    const combo = within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('combobox');
    fireEvent.keyDown(combo, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('home-calendar-peek-status-editor')).toBeNull();
    });
    expect(screen.getByTestId('home-calendar-peek-card')).toBeInTheDocument();
  });

  it('rolls back status after a failed save and stays in editing state', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { status: 'in_progress' });
    mutateAsyncMock.mockRejectedValueOnce(new Error('boom'));
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));
    const editor = screen.getByTestId('home-calendar-peek-status-editor');
    await user.click(within(editor).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '已完成' }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('home-calendar-peek-status-editor')).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('combobox')).toHaveTextContent('进行中');
    expect(screen.getByText('保存失败，请重试')).toBeInTheDocument();
  });

  it('saves category inline from the controlled option source', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { category: 'practice' });
    const list: CalendarPeekListEntry[] = [
      { id: 'e1', event },
      { id: 'e2', event: makeEvent('e2', { category: 'review', targetId: 31 }) },
    ];
    mutateAsyncMock.mockResolvedValueOnce({ ...event, category: 'review' });
    renderWithPeek(event, list);

    await user.click(screen.getByTitle('edit-category'));
    const editor = screen.getByTestId('home-calendar-peek-category-editor');
    await user.click(within(editor).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'review' }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { category: 'review' });
    });
  });

  it('clears target inline with explicit null semantics', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { targetId: 23 });
    mutateAsyncMock.mockResolvedValueOnce({ ...event, targetId: null });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-target'));
    const editor = screen.getByTestId('home-calendar-peek-target-editor');
    await user.click(within(editor).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '无' }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { targetId: null });
    });
  });

  it('keeps a saved prop value after stepping away and back inside the same peek session', async () => {
    const user = userEvent.setup();
    const list: CalendarPeekListEntry[] = [
      { id: 'e1', event: makeEvent('e1', { status: 'in_progress' }) },
      { id: 'e2', event: makeEvent('e2', { title: 'Neighbor event' }) },
    ];
    mutateAsyncMock.mockResolvedValueOnce({ ...list[0].event, status: 'done' });
    renderWithPeek(list[0].event, list);

    await user.click(screen.getByTitle('edit-status'));
    await user.click(within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '已完成' }));
    await user.click(within(screen.getByTestId('home-calendar-peek-status-editor')).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('home-calendar-peek-status')).toHaveTextContent('已完成');
    });

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByText('Neighbor event')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(screen.getByTestId('home-calendar-peek-status')).toHaveTextContent('已完成');
  });

  it('preserves unrelated optimistic patches for the same event after a successful save', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1', { title: 'Original title' });
    usePlanStore.getState().upsertOptimisticEvent('e1', { startAt: '2026-05-30T09:00:00+08:00' });
    mutateAsyncMock.mockResolvedValueOnce({ ...event, title: 'Renamed title' });
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-title'));
    const input = within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Renamed title');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith('e1', { title: 'Renamed title' });
    });
    expect(usePlanStore.getState().optimisticEvents.get('e1')).toEqual({
      startAt: '2026-05-30T09:00:00+08:00',
    });
  });

  it('has no axe violations while a prop editor is open', async () => {
    const user = userEvent.setup();
    const event = makeEvent('e1');
    renderWithPeek(event, [{ id: 'e1', event }]);

    await user.click(screen.getByTitle('edit-status'));

    const results = await axe.run(screen.getByTestId('home-calendar-peek-card'), AXE_OPTIONS);
    expect(results.violations).toEqual([]);
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

    await user.click(screen.getByTitle('edit-title'));
    await user.type(within(screen.getByTestId('home-calendar-peek-title-editor')).getByRole('textbox'), ' X');
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
