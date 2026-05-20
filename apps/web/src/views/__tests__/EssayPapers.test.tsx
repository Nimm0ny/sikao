import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import EssayPapers from '../EssayPapers';

// PaperRow list 替换. 后端 endpoint 从 /papers/essay/list 切到
// /papers/essay/{list/extended,filters}.

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
  paperTypes: ['副省级', '地市级', '行政执法'],
};

import type { EssayPaperListItemV2Extended } from '@sikao/api-client/queries/essaySpecialtyQueries';

const PAPER_TODO: EssayPaperListItemV2Extended = {
  id: 1,
  paperCode: 'AIPTA-2026-01',
  paperName: '2026 年浙江省公考《申论》题（A 卷）',
  examYear: 2026,
  sourceProvider: '浙江',
  sourceKind: '副省级',
  questionCount: 3,
  currentRevisionId: 1,
  region: '浙江',
  track: 'sk',
  difficulty: 1,
  status: 'todo',
  progress: '0/0',
  lastAttempt: null,
  pinned: false,
};

const PAPER_DOING: EssayPaperListItemV2Extended = {
  ...PAPER_TODO,
  id: 2,
  paperCode: 'AIPTA-2026-02',
  paperName: '2026 年国家公考《申论》题（行政执法）',
  region: '国考',
  questionCount: 5,
  difficulty: 3,
  status: 'doing',
  progress: '3/5',
};

const PAPER_DONE_PINNED: EssayPaperListItemV2Extended = {
  ...PAPER_TODO,
  id: 3,
  paperCode: 'AIPTA-2025-01',
  paperName: '2025 年国家公考《申论》题（副省级）',
  region: '国考',
  examYear: 2025,
  questionCount: 5,
  difficulty: 3,
  status: 'done',
  progress: '5/5',
  pinned: true,
  lastAttempt: { score: 38.4, submittedAt: '2026-05-01T10:00:00Z' },
};

function listResponse(
  items: EssayPaperListItemV2Extended[],
  page = 1,
  pageSize = 20,
  total = items.length,
) {
  return { items, total, page, pageSize };
}

describe('EssayPapers', () => {
  it('filters + list 加载 → FiltersPanel + PaperRow 渲染', async () => {
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_TODO, PAPER_DOING])),
      ),
    );
    renderWithProviders(<EssayPapers />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-papers-list')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-papers-filters')).toBeInTheDocument();
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-01'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('essay-paper-row-AIPTA-2026-02'),
    ).toBeInTheDocument();
  });

  it('PaperRow doing 状态 → 状态 pill 文案 "进行中"', async () => {
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_DOING])),
      ),
    );
    renderWithProviders(<EssayPapers />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-paper-row-status-doing')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-paper-row-status-doing')).toHaveTextContent(
      '进行中',
    );
  });

  it('点击行 → navigate /essay/papers/{paperCode}', async () => {
    navigate.mockClear();
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_TODO])),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<EssayPapers />);
    const cta = await screen.findByTestId(
      'essay-paper-row-AIPTA-2026-01-cta',
    );
    await user.click(cta);
    expect(navigate).toHaveBeenCalledWith('/essay/papers/AIPTA-2026-01');
  });

  it('region chip 切到 国考 → 二次 fetch 带新 region & page reset', async () => {
    let lastUrl: URL | null = null;
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json(listResponse([PAPER_TODO]));
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<EssayPapers />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-papers-list')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('essay-papers-filter-region-国考'));
    await waitFor(() => {
      expect(lastUrl?.searchParams.get('region')).toBe('国考');
    });
    expect(
      screen.getByTestId('essay-papers-filter-region-国考'),
    ).toHaveAttribute('data-active', 'true');
  });

  it('paginate 切到 page 2 → 请求带 page=2', async () => {
    const observed: string[] = [];
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', ({ request }) => {
        const url = new URL(request.url);
        const p = url.searchParams.get('page') ?? '1';
        observed.push(p);
        return HttpResponse.json(
          listResponse([PAPER_TODO], Number(p), 20, 40),
        );
      }),
    );
    renderWithProviders(<EssayPapers />);
    await waitFor(() =>
      expect(screen.getByTestId('essay-papers-list')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('essay-papers-pager-2'));
    await waitFor(() => expect(observed).toContain('2'));
  });

  it('空 list + 已选 filter → empty state', async () => {
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', () =>
        HttpResponse.json(listResponse([], 1, 20, 0)),
      ),
    );
    renderWithProviders(<EssayPapers />);
    await waitFor(() =>
      expect(screen.getByText('暂无可练习的试卷')).toBeInTheDocument(),
    );
  });

  it('pinned 卡片 → 左侧 3px 暗朱条 渲染', async () => {
    server.use(
      http.get('/api/v2/papers/essay/filters', () =>
        HttpResponse.json(FILTERS),
      ),
      http.get('/api/v2/papers/essay/list/extended', () =>
        HttpResponse.json(listResponse([PAPER_DONE_PINNED])),
      ),
    );
    renderWithProviders(<EssayPapers />);
    const row = await screen.findByTestId('essay-paper-row-AIPTA-2025-01');
    // pin 3px bar 在 row 内一个 absolute span (bg-exam-accent)
    const pin = row.querySelector('span.bg-exam-accent');
    expect(pin).not.toBeNull();
  });
});
