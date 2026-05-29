// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const apiPostMock = vi.fn();

vi.mock('./request', () => ({
  api: {
    get: vi.fn(),
    post: (...args: unknown[]) => apiPostMock(...args),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { fetchEventAggregates, useEventAggregates } from './plansQueries';

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

describe('plansQueries', () => {
  it('fetchEventAggregates sorts and dedupes event ids before posting', async () => {
    apiPostMock.mockResolvedValueOnce({ items: [] });

    await fetchEventAggregates({ eventIds: ['evt-b', 'evt-a', 'evt-b'] });

    expect(apiPostMock).toHaveBeenCalledWith('/plans/events/aggregates', {
      eventIds: ['evt-a', 'evt-b'],
    });
  });

  it('useEventAggregates stays disabled for empty ids', () => {
    const client = makeClient();
    const { result } = renderHook(() => useEventAggregates([]), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isFetched).toBe(false);
  });

  it('useEventAggregates uses normalized ids in the query function', async () => {
    apiPostMock.mockResolvedValueOnce({
      items: [
        {
          eventId: 'evt-a',
          linkedSessionId: null,
          availability: 'missing_linked_session',
          metrics: null,
        },
        {
          eventId: 'evt-b',
          linkedSessionId: null,
          availability: 'missing_linked_session',
          metrics: null,
        },
      ],
    });

    const client = makeClient();
    const { result } = renderHook(() => useEventAggregates(['evt-b', 'evt-a', 'evt-b']), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.map((item) => item.eventId)).toEqual(['evt-a', 'evt-b']);
    expect(apiPostMock).toHaveBeenCalledWith('/plans/events/aggregates', {
      eventIds: ['evt-a', 'evt-b'],
    });
  });
});
