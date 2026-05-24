import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MockExamHistoryView } from './MockExamHistoryView';

function renderMockExamHistoryView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [
      { path: '/practice/mock-exam/history', element: <MockExamHistoryView /> },
      { path: '/practice/mock-exam/start', element: <div data-testid="mock-exam-start-route-hit" /> },
      { path: '/practice/mock-exam/:sessionId/comparison', element: <div data-testid="mock-exam-comparison-route-hit" /> },
    ],
    { initialEntries: ['/practice/mock-exam/history'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('MockExamHistoryView', () => {
  it('renders aggregate cards and history sessions', async () => {
    renderMockExamHistoryView();
    expect(await screen.findByTestId('mock-exam-history-view')).toBeInTheDocument();
    expect(await screen.findAllByText('XC-MOCK-HISTORY-001')).toHaveLength(2);
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
  });

  it('navigates to comparison from a session entry', async () => {
    renderMockExamHistoryView();
    await screen.findByTestId('mock-exam-history-view');
    await screen.findAllByText('XC-MOCK-HISTORY-001');
    await userEvent.click(screen.getAllByRole('button', { name: 'View comparison' })[0]!);
    expect(await screen.findByTestId('mock-exam-comparison-route-hit')).toBeInTheDocument();
  });
});
