import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';

import ProfileRecords from '../ProfileRecords';

describe('ProfileRecords view', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('renders grouped records and row hrefs from the backend contract', async () => {
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({
          items: [
            {
              id: 'practice-42',
              kind: 'xingce_practice',
              title: 'Morning drill',
              status: 'completed',
              href: '/practice/result/42',
              score: '72.50',
              occurredAt: '2026-05-22T01:00:00Z',
            },
            {
              id: 'essay-submission-7',
              kind: 'essay_submission',
              title: 'Essay submission',
              status: 'pending',
              href: '/essay/history',
              score: null,
              occurredAt: '2026-05-21T13:00:00Z',
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    renderWithProviders(<ProfileRecords />, {
      initialEntries: ['/profile/records'],
    });

    expect(await screen.findByTestId('profile-records-ready')).toBeInTheDocument();
    expect(screen.getAllByTestId(/profile-records-group-/)).toHaveLength(2);
    expect(screen.getByTestId('profile-record-link-practice-42')).toHaveAttribute(
      'href',
      '/practice/result/42',
    );
    expect(screen.getByTestId('profile-record-link-essay-submission-7')).toHaveAttribute(
      'href',
      '/essay/history',
    );
  });

  it('forwards URL filters to the canonical records endpoint and surfaces session focus', async () => {
    let capturedSearch = '';
    server.use(
      http.get('/api/v2/profile/records', ({ request }) => {
        capturedSearch = new URL(request.url).search;
        return HttpResponse.json({
          items: [
            {
              id: 'essay-submission-9',
              kind: 'essay_submission',
              title: 'Essay submission',
              status: 'completed',
              href: '/essay/grades/3',
              score: '81.00',
              occurredAt: '2026-05-22T03:00:00Z',
            },
          ],
          total: 1,
          page: 2,
          pageSize: 10,
        });
      }),
    );

    renderWithProviders(<ProfileRecords />, {
      initialEntries: [
        '/profile/records?kind=essay_submission&status=completed&from=2026-05-20&to=2026-05-22&page=2&size=10&session_id=42',
      ],
    });

    expect(await screen.findByTestId('profile-records-ready')).toBeInTheDocument();
    expect(capturedSearch).toContain('kind=essay_submission');
    expect(capturedSearch).toContain('status=completed');
    expect(capturedSearch).toContain('from=2026-05-20');
    expect(capturedSearch).toContain('to=2026-05-22');
    expect(capturedSearch).toContain('page=2');
    expect(capturedSearch).toContain('size=10');
    expect(capturedSearch).toContain('session_id=42');
    expect(screen.getByTestId('profile-records-session-hint')).toHaveTextContent('session #42');
  });

  it('updates filters and pagination through search-param driven requests', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];

    server.use(
      http.get('/api/v2/profile/records', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        const page = Number(url.searchParams.get('page') ?? '1');
        const size = Number(url.searchParams.get('size') ?? '20');
        return HttpResponse.json({
          items: [
            {
              id: `practice-${page}`,
              kind: 'xingce_practice',
              title: `Practice page ${page}`,
              status: 'pending',
              href: `/practice/sessions/${page}`,
              score: null,
              occurredAt: '2026-05-22T03:00:00Z',
            },
          ],
          total: 45,
          page,
          pageSize: size,
        });
      }),
    );

    renderWithProviders(<ProfileRecords />, {
      initialEntries: ['/profile/records'],
    });

    expect(await screen.findByTestId('profile-records-ready')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('records status'), 'completed');
    await waitFor(() =>
      expect(requests.at(-1) ?? '').toContain('status=completed'),
    );

    await user.selectOptions(screen.getByLabelText('records page size'), '10');
    await waitFor(() => expect(requests.at(-1) ?? '').toContain('size=10'));

    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(requests.at(-1) ?? '').toContain('page=2'));
  });

  it('ignores invalid session_id params instead of sending session_id=0', async () => {
    let capturedSearch = '';
    server.use(
      http.get('/api/v2/profile/records', ({ request }) => {
        capturedSearch = new URL(request.url).search;
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        });
      }),
    );

    renderWithProviders(<ProfileRecords />, {
      initialEntries: ['/profile/records?session_id=abc'],
    });

    expect(await screen.findByText('暂无学习记录')).toBeInTheDocument();
    expect(capturedSearch).not.toContain('session_id=');
    expect(screen.queryByTestId('profile-records-session-hint')).toBeNull();
  });
});
