import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MockExamStartView } from './MockExamStartView';

function renderMockExamStartView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice/mock-exam/start', element: <MockExamStartView /> },
      { path: '/practice/sessions/:sessionId', element: <div data-testid="mock-exam-session-route-hit" /> },
      { path: '/practice/mock-exam/history', element: <div data-testid="mock-exam-history-route-hit" /> },
    ],
    { initialEntries: ['/practice/mock-exam/start'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('MockExamStartView', () => {
  it('creates a mock exam and navigates to the runtime session route', async () => {
    renderMockExamStartView();
    expect(await screen.findByTestId('mock-exam-start-view')).toBeInTheDocument();
    expect(await screen.findByText(/XC-2024-01/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Create mock exam' })[0]!);
    expect(await screen.findByTestId('mock-exam-session-route-hit')).toBeInTheDocument();
  });

  it('navigates to mock exam history from the header action', async () => {
    renderMockExamStartView();
    await screen.findByTestId('mock-exam-start-view');
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByTestId('mock-exam-history-route-hit')).toBeInTheDocument();
  });
});
