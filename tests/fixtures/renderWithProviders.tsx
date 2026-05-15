import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, type InitialEntry } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

// renderWithProviders — wrap a view in BrowserRouter + QueryClientProvider
// so view-level RTL tests don't have to bootstrap context manually.
//
// MemoryRouter is intentionally chosen over BrowserRouter: jsdom doesn't
// have a real navigation stack and BrowserRouter's history sync to
// `window.history` makes per-test isolation harder. MemoryRouter takes
// `initialEntries` so a test can land on `/login` directly.
//
// QueryClient defaults overridden:
//   - retry: false — failures should surface immediately in tests, not
//     retry 3 times (default) and slow the suite.
//   - gcTime / staleTime: 0 — no cross-test caching.

export interface RenderProvidersOptions extends Omit<RenderOptions, 'queue'> {
  readonly initialEntries?: readonly InitialEntry[];
  readonly queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderProvidersOptions = {},
): RenderResult & { readonly queryClient: QueryClient } {
  const { initialEntries = ['/'], queryClient: providedClient, ...rest } = options;

  const queryClient =
    providedClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[...initialEntries]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...rest }),
    queryClient,
  };
}
