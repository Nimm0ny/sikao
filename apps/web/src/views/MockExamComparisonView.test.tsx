import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MockExamComparisonView } from './MockExamComparisonView';

function renderMockExamComparisonView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter(
    [{ path: '/practice/mock-exam/:sessionId/comparison', element: <MockExamComparisonView /> }],
    { initialEntries: ['/practice/mock-exam/7302/comparison'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('MockExamComparisonView', () => {
  it('renders current session, self history, and paper baseline panels', async () => {
    renderMockExamComparisonView();
    expect(await screen.findByTestId('mock-exam-comparison-view')).toBeInTheDocument();
    expect(await screen.findByText(/Paper:\s*XC-MOCK-HISTORY-001/)).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Self history')).toBeInTheDocument();
    expect(screen.getByText('Paper baseline')).toBeInTheDocument();
    expect(screen.getByText('No paper baseline')).toBeInTheDocument();
    expect(screen.getByText(/Rank in self:\s*1/)).toBeInTheDocument();
  });
});
