import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const fetchEventAggregatesMock = vi.fn();

vi.mock('@sikao/api-client/plansQueries', () => ({
  fetchEventAggregates: (payload: { eventIds: string[] }) => fetchEventAggregatesMock(payload),
}));

import { useCalendarEventAggregates } from './eventAggregates';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useCalendarEventAggregates', () => {
  it('splits more than 100 event ids into multiple batch requests', async () => {
    fetchEventAggregatesMock.mockImplementation(async ({ eventIds }: { eventIds: string[] }) => ({
      items: eventIds.map((eventId) => ({
        eventId,
        linkedSessionId: null,
        availability: 'missing_linked_session',
        metrics: null,
      })),
    }));

    const ids = Array.from({ length: 105 }, (_, index) => `evt-${String(index).padStart(3, '0')}`);
    const client = makeClient();
    const { result } = renderHook(() => useCalendarEventAggregates(ids), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(fetchEventAggregatesMock).toHaveBeenCalledTimes(2);
    expect(fetchEventAggregatesMock.mock.calls[0][0].eventIds).toHaveLength(100);
    expect(fetchEventAggregatesMock.mock.calls[1][0].eventIds).toHaveLength(5);
    expect(result.current.byEventId.size).toBe(105);
  });
});
