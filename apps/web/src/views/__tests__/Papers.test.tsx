/**
 * Papers — SIKAO Wave 5A /papers 行测套卷题库 hifi 升级测试.
 *
 * 接 Xa-BE 7a06b94 2 endpoint (mirror EssayPapers):
 *   - /papers/xingce/filters         → FiltersPanel chip
 *   - /papers/xingce/list/extended   → PaperRow list + paginate
 *
 * 旧 PaperListSection grid + clientside FENBI- prefix filter 测试整套替换.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import Papers from '../Papers';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const FILTERS = {
  regions: ['国考', '省考', '广东', '江苏'],
  years: [2026, 2025, 2024],
  paperTypes: ['国考', '省考', '事业单位'],
};

import type { XingcePaperListItemV2Extended } from '@sikao/api-client/queries/xingceSpecialtyQueries';

const PAPER_TODO: XingcePaperListItemV2Extended = {
  id: 1,
  paperCode: 'FENBI-2026-01',
  paperName: '2026 国考行测真题',
  examYear: 2026,
  sourceProvider: '国考',
  sourceKind: '国考',
  questionCount: 130,
  currentRevisionId: 1,
  region: '国考',
  track: 'gk',
  difficulty: 2,
  status: 'todo',
  progress: '0/0',
  lastAttempt: null,
  pinned: false,
};

const PAPER_DOING: XingcePaperListItemV2Extended = {
  ...PAPER_TODO,
  id: 2,
  paperCode: 'FENBI-2026-02',
  paperName: '2026 联考行测',
  region: '广东',
  sourceProvider: '广东',
  sourceKind: '省考',
  questionCount: 120,
  difficulty: 2,
  status: 'doing',
  progress: '30/120',
};

const PAPER_DONE_PINNED: XingcePaperListItemV2Extended = {
  ...PAPER_TODO,
  id: 3,
  paperCode: 'FENBI-2025-01',
  paperName: '2025 国考行测真题',
  region: '国考',
  examYear: 2025,
  questionCount: 130,
  difficulty: 3,
  status: 'done',
  progress: '130/130',
  pinned: true,
  lastAttempt: { score: 78.5, submittedAt: '2026-05-01T10:00:00Z' },
};

function listResponse(
  items: XingcePaperListItemV2Extended[],
  page = 1,
  pageSize = 20,
  total = items.length,
) {
  return { items, total, page, pageSize };
}

describe('Papers (xingce papers)', () => {
  it('filters + list 加载 → FiltersPanel + PaperRow 渲染', async () => {
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_TODO, PAPER_DOING])),
      ),
    );
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    await waitFor(() =>
      expect(screen.getByTestId('xingce-papers-list')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('xingce-papers-filters')).toBeInTheDocument();
    expect(
      screen.getByTestId('xingce-paper-row-FENBI-2026-01'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('xingce-paper-row-FENBI-2026-02'),
    ).toBeInTheDocument();
  });

  it('PaperRow doing 状态 → 状态 pill 文案 "进行中"', async () => {
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_DOING])),
      ),
    );
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    await waitFor(() =>
      expect(screen.getByTestId('xingce-paper-row-status-doing')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('xingce-paper-row-status-doing')).toHaveTextContent(
      '进行中',
    );
  });

  it('点击行 → navigate /practice/{paperCode}/start', async () => {
    navigate.mockClear();
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_TODO])),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    const cta = await screen.findByTestId(
      'xingce-paper-row-FENBI-2026-01-cta',
    );
    await user.click(cta);
    expect(navigate).toHaveBeenCalledWith('/practice/FENBI-2026-01/start');
  });

  it('region chip 切到 国考 → 二次 fetch 带新 region & page reset', async () => {
    let lastUrl: URL | null = null;
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json(listResponse([PAPER_TODO]));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    await waitFor(() =>
      expect(screen.getByTestId('xingce-papers-list')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('xingce-papers-filter-region-国考'));
    await waitFor(() => {
      expect(lastUrl?.searchParams.get('region')).toBe('国考');
    });
    expect(
      screen.getByTestId('xingce-papers-filter-region-国考'),
    ).toHaveAttribute('data-active', 'true');
  });

  it('paginate 切到 page 2 → 请求带 page=2', async () => {
    const observed: string[] = [];
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', ({ request }) => {
        const url = new URL(request.url);
        const p = url.searchParams.get('page') ?? '1';
        observed.push(p);
        return HttpResponse.json(
          listResponse([PAPER_TODO], Number(p), 20, 40),
        );
      }),
    );
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    await waitFor(() =>
      expect(screen.getByTestId('xingce-papers-list')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('xingce-papers-pager-2'));
    await waitFor(() => expect(observed).toContain('2'));
  });

  it('空 list + 已选 filter → empty state', async () => {
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', () =>
        HttpResponse.json(listResponse([], 1, 20, 0)),
      ),
    );
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    await waitFor(() =>
      expect(screen.getByText('暂无可练习的试卷')).toBeInTheDocument(),
    );
  });

  it('pinned 卡片 → 左侧 3px 暗朱条 渲染', async () => {
    server.use(
      http.get('/api/v2/papers/xingce/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/xingce/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_DONE_PINNED])),
      ),
    );
    renderWithProviders(<Papers />, { initialEntries: ['/papers'] });
    const row = await screen.findByTestId('xingce-paper-row-FENBI-2025-01');
    const pin = row.querySelector('span.bg-exam-accent');
    expect(pin).not.toBeNull();
  });
});
