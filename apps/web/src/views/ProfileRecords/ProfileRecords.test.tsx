/*
 * ProfileRecords tests — SIK-93 ProfileRecords timeline rewrite.
 *
 * 4-state coverage (loading / error / empty / ready) + filter pill
 * interaction + day-group + RecordRow href contract + RecordsFoot
 * load-more state + kind染色 (no hard-coded cat-yanyu).
 *
 * Why: Acceptance C1-C8 live here. Tests assert against data-testid
 *      hooks owned by FilterBar / DayGroup / RecordRow / RecordsFoot
 *      so visual rewrites can land without breaking the contract.
 *      Nav baseline (4 tabs) untouched — sub-nav assertions are for
 *      the in-page Profile sub-nav only.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const RECORD_PRACTICE = {
  id: 'practice-6001',
  kind: 'xingce_practice',
  title: 'Xingce practice',
  occurredAt: '2026-05-23T10:42:00Z',
  score: '76.5',
  status: 'completed',
  href: '/practice/sessions/6001/result',
};

const RECORD_ESSAY = {
  id: 'essay-submission-9',
  kind: 'essay_submission',
  title: 'Essay submission',
  occurredAt: '2026-05-22T21:08:00Z',
  score: '38',
  status: 'completed',
  href: '/practice/essay/submissions/9/result',
};

describe('ProfileRecords (SIK-93 timeline rewrite)', () => {
  it('ready: renders sub-nav, filter-bar, day-group, RecordRow with kind染色 + Link href', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({
        items: [RECORD_PRACTICE, RECORD_ESSAY],
        page: 1,
        pageSize: 20,
        total: 2,
      }),
    ));
    renderWithEnv();
    await waitFor(() =>
      expect(screen.getByTestId('profile-records-row-practice-6001')).toBeInTheDocument(),
    );

    // Profile in-page sub-nav (NOT global navigation; H12 4-tab
    // baseline at Rail/BottomTabBar untouched).
    const subNav = screen.getByTestId('profile-sub-nav');
    expect(within(subNav).getByText('学习记录')).toHaveAttribute('aria-current', 'page');

    // filter-bar 5 seg-pills rendered
    const filter = screen.getByTestId('profile-records-filter');
    expect(within(filter).getByText('全部活动')).toBeInTheDocument();
    expect(within(filter).getByText('练习')).toBeInTheDocument();
    expect(within(filter).getByText('模考')).toBeInTheDocument();
    expect(within(filter).getByText('复盘')).toBeInTheDocument();
    expect(within(filter).getByText('笔记')).toBeInTheDocument();

    // day-group sticky head + RecordRow with kind variant
    const practiceRow = screen.getByTestId('profile-records-row-practice-6001');
    expect(practiceRow).toHaveAttribute('href', '/practice/sessions/6001/result');
    expect(practiceRow).toHaveAttribute('data-kind', 'practice');

    const essayRow = screen.getByTestId('profile-records-row-essay-submission-9');
    expect(essayRow).toHaveAttribute('href', '/practice/essay/submissions/9/result');
    expect(essayRow).toHaveAttribute('data-kind', 'shenlun');

    // records-foot 加载更早 btn rendered (canLoadMore=false here, total=items)
    const loadMore = screen.getByTestId('profile-records-load-more');
    expect(loadMore).toBeDisabled();
    expect(loadMore).toHaveTextContent('已加载全部');
  });

  it('empty: renders EmptyState when API returns 0 items', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
    ));
    renderWithEnv();
    await waitFor(() =>
      expect(screen.getByTestId('profile-records-empty')).toBeInTheDocument(),
    );
    // sub-nav + filter-bar still visible per contract §3
    expect(screen.getByTestId('profile-sub-nav')).toBeInTheDocument();
    expect(screen.getByTestId('profile-records-filter')).toBeInTheDocument();
  });

  it('error: renders error state on 500 + keeps filter-bar visible', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({}, { status: 500 }),
    ));
    renderWithEnv();
    await waitFor(() =>
      expect(screen.getByTestId('profile-records-error')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-records-filter')).toBeInTheDocument();
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/profile/records', async () => {
      await delay(50);
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
    }));
    renderWithEnv();
    expect(screen.getByTestId('profile-records-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('profile-records-loading')).not.toBeInTheDocument(),
    );
  });

  it('filter: clicking 练习 pill sends kind=xingce_practice + resets page to 1', async () => {
    let lastUrl = '';
    server.use(http.get('/api/v2/profile/records', ({ request }) => {
      lastUrl = request.url;
      return HttpResponse.json({
        items: [RECORD_PRACTICE], page: 1, pageSize: 20, total: 1,
      });
    }));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records')).toBeInTheDocument());

    const filter = screen.getByTestId('profile-records-filter');
    const practicePill = within(filter).getByRole('tab', { name: '练习' });
    await userEvent.click(practicePill);
    await waitFor(() => expect(lastUrl).toContain('kind=xingce_practice'));
    expect(lastUrl).toContain('page=1');
  });

  it('filter: 模考 / 复盘 / 笔记 pills are disabled (backend doesn\'t emit those kinds yet)', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({ items: [RECORD_PRACTICE], page: 1, pageSize: 20, total: 1 }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records-filter')).toBeInTheDocument());
    const filter = screen.getByTestId('profile-records-filter');
    expect(within(filter).getByRole('tab', { name: '模考' })).toBeDisabled();
    expect(within(filter).getByRole('tab', { name: '复盘' })).toBeDisabled();
    expect(within(filter).getByRole('tab', { name: '笔记' })).toBeDisabled();
  });

  it('records-foot: canLoadMore=true when total > items.length', async () => {
    server.use(http.get('/api/v2/profile/records', () =>
      HttpResponse.json({
        items: [RECORD_PRACTICE], page: 1, pageSize: 20, total: 25,
      }),
    ));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('profile-records-load-more')).toBeInTheDocument());
    const loadMore = screen.getByTestId('profile-records-load-more');
    expect(loadMore).not.toBeDisabled();
    expect(loadMore).toHaveTextContent('加载更早记录 ↓');
  });
});
