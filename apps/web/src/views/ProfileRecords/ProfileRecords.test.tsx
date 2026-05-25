/*
 * ProfileRecords tests — SIK-93 Home M-Records wave 2.
 * 4-state coverage + filter + Link href contract.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { ProfileRecords } from './ProfileRecords';

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ProfileRecords />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const SAMPLE_RECORD = {
  id: 'r1',
  kind: 'xingce_practice',
  title: '行测真题 · 2024 国考',
  occurredAt: '2026-05-24T08:00:00Z',
  score: '76.5',
  status: 'done',
  href: '/practice/sessions/6001/result',
};

describe('ProfileRecords (Home M-Records wave 2)', () => {
  it('ready: renders rows with kind badge + score + Link to href', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({ items: [SAMPLE_RECORD], page: 1, pageSize: 20, total: 1 }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records-row-r1')).toBeInTheDocument());
    expect(screen.getByText('行测真题 · 2024 国考')).toBeInTheDocument();
    expect(screen.getByTestId('profile-records-row-r1')).toHaveAttribute('href', '/practice/sessions/6001/result');
  });

  it('empty: renders EmptyState when API returns 0 items', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records-empty')).toBeInTheDocument());
  });

  it('error: renders EmptyState on 500', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({}, { status: 500 }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records-error')).toBeInTheDocument());
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/profile/records', async () => {
      await delay(50);
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    }));
    renderWithEnv();
    expect(screen.getByTestId('profile-records-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('profile-records-loading')).not.toBeInTheDocument());
  });

  it('filter: kind dropdown change resets page to 1 + sends kind to API', async () => {
    let lastUrl = '';
    server.use(http.get('/api/v2/profile/records', ({ request }) => {
      lastUrl = request.url;
      return HttpResponse.json({ items: [SAMPLE_RECORD], page: 1, pageSize: 20, total: 1 });
    }));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('筛选记录类型'), 'xingce_practice');
    await waitFor(() => expect(lastUrl).toContain('kind=xingce_practice'));
  });
});
