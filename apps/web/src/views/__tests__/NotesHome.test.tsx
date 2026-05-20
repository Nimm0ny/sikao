/**
 *
 * 三态覆盖:
 * 1. loading
 * 2. data (notes + stats + due 全 OK)
 * 3. auth fail (401)
 * 4. error (notes + stats 500)
 * 5. empty (stats.total=0)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@sikao/test-utils/server';
import NotesHome from '../NotesHome';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderView(client?: QueryClient) {
  return render(
    <QueryClientProvider client={client ?? makeClient()}>
      <MemoryRouter initialEntries={['/notes']}>
        <Routes>
          <Route path="/notes" element={<NotesHome />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// IntersectionObserver mock (跟 Plan.test.tsx 同款 pattern)
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  disconnect: () => void;
  observe: () => void;
  unobserve: () => void;
  takeRecords: () => IntersectionObserverEntry[];
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    this.disconnect = vi.fn();
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.takeRecords = vi.fn(() => []);
  }
}

beforeEach(() => {
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  delete (globalThis as { IntersectionObserver?: typeof IntersectionObserver })
    .IntersectionObserver;
});

describe('NotesHome · view', () => {
  it('loading: 渲 skeleton', () => {
    server.use(
      http.get('/api/v2/notebook/notes', async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
      http.get('/api/v2/notebook/stats', async () => {
        await new Promise((r) => setTimeout(r, 1000));
        return HttpResponse.json({
          total: 0,
          dueCount: 0,
          byType: {},
          bySourceDomain: {},
        });
      }),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    expect(screen.getByTestId('notes-home-loading')).toBeInTheDocument();
  });

  it('data: 渲 view + capture bar + toolbar + tabs', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              type: 'quote',
              body: { text: '示例金句' },
              sourceKind: 'manual',
              sourceRef: 'src-1',
              sourceQuote: null,
              sourceDomain: 'essay',
              title: 'note-1',
              tags: [],
              attachedTo: null,
              visibility: 'self',
              ease: 2.5,
              reviewCount: 0,
              reviewedAt: null,
              nextReviewAt: null,
              createdAt: '2026-05-12T00:00:00Z',
              updatedAt: '2026-05-12T00:00:00Z',
            },
          ],
          nextCursor: null,
        }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({
          total: 1,
          dueCount: 0,
          byType: { quote: 1 },
          bySourceDomain: { essay: 1 },
        }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId('notes-home-view')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('notes-home-capture-bar')).toBeInTheDocument();
    expect(screen.getByTestId('notes-home-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('notes-home-type-tabs')).toBeInTheDocument();
    expect(screen.getByText('示例金句')).toBeInTheDocument();
  });

  it('auth fail: 401 → fallback', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(
        screen.getByTestId('notes-home-auth-fallback'),
      ).toBeInTheDocument(),
    );
  });

  it('error: 500 + retry 按钮', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(
      () => expect(screen.getByTestId('notes-home-error')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByTestId('notes-home-retry')).toBeInTheDocument();
  });

  it('error: notes 404 + stats 200 不得误报 empty state', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({
          total: 0,
          dueCount: 0,
          byType: {},
          bySourceDomain: {},
        }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId('notes-home-error')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('notes-home-empty-cta')).not.toBeInTheDocument();
  });

  it('empty: total=0 + 空 notes → 显 empty state', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({
          total: 0,
          dueCount: 0,
          byType: {},
          bySourceDomain: {},
        }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId('notes-home-view')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('notes-home-empty-cta')).toBeInTheDocument();
  });

  it('notes items 非空但 stats.total=0 时仍显示列表', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({
          items: [
            {
              id: 2,
              type: 'reflect',
              body: { text: '错位 total 不该吃掉列表' },
              sourceKind: 'manual',
              sourceRef: 'src-2',
              sourceQuote: null,
              sourceDomain: 'xingce',
              title: 'note-2',
              tags: [],
              attachedTo: null,
              visibility: 'self',
              ease: 2.5,
              reviewCount: 0,
              reviewedAt: null,
              nextReviewAt: null,
              createdAt: '2026-05-12T00:00:00Z',
              updatedAt: '2026-05-12T00:00:00Z',
            },
          ],
          nextCursor: null,
        }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({
          total: 0,
          dueCount: 0,
          byType: { reflect: 0 },
          bySourceDomain: { xingce: 0 },
        }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId('notes-home-view')).toBeInTheDocument(),
    );
    expect(screen.getByText('错位 total 不该吃掉列表')).toBeInTheDocument();
    expect(screen.queryByTestId('notes-home-empty-cta')).not.toBeInTheDocument();
  });

  it('stats 缺少子字段时不 crash', async () => {
    server.use(
      http.get('/api/v2/notebook/notes', () =>
        HttpResponse.json({
          items: [
            {
              id: 3,
              type: 'quote',
              body: { text: '缺 stats 子字段也要正常渲染' },
              sourceKind: 'manual',
              sourceRef: 'src-3',
              sourceQuote: null,
              sourceDomain: 'essay',
              title: 'note-3',
              tags: [],
              attachedTo: null,
              visibility: 'self',
              ease: 2.5,
              reviewCount: 0,
              reviewedAt: null,
              nextReviewAt: null,
              createdAt: '2026-05-12T00:00:00Z',
              updatedAt: '2026-05-12T00:00:00Z',
            },
          ],
          nextCursor: null,
        }),
      ),
      http.get('/api/v2/notebook/stats', () =>
        HttpResponse.json({
          total: 1,
          dueCount: 0,
        }),
      ),
      http.get('/api/v2/notebook/reviews/due', () =>
        HttpResponse.json({ items: [], nextCursor: null }),
      ),
      http.get('/api/v2/exam-events', () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId('notes-home-view')).toBeInTheDocument(),
    );
    expect(screen.getByText('缺 stats 子字段也要正常渲染')).toBeInTheDocument();
    expect(screen.getByTestId('notes-home-toolbar')).toBeInTheDocument();
  });
});
