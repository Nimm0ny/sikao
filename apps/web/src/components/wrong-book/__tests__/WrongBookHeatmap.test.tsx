/**
 * SIKAO Wave 5 · WrongBookHeatmap vitest.
 *
 * 6 case 覆盖 component 三态 + 关键视觉断言:
 *   1) renders 5 rows × 30 cols (grid 完整渲染)
 *   2) today outline (ring-accent class on idx=29 cell)
 *   3) peak triangle (peakIdx 命中 cell 含 data-peak attribute)
 *   4) loading skeleton (delayed handler → skeleton 渲染)
 *   5) error state (500 → QueryBoundary error + retry button)
 *   6) empty state (全 0 cells → 5 行仍渲染 + 无 peak)
 *
 * MSW handler 用 server.use() 覆盖 default handler; afterEach 自动 reset.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { WrongBookHeatmap } from '../WrongBookHeatmap';

const SUBJECTS = ['言语', '数量', '判推', '资分', '常识'] as const;

interface Cell {
  readonly date: string;
  readonly count: number;
  readonly rate: number | null;
}

interface Row {
  readonly subject: (typeof SUBJECTS)[number];
  readonly total: number;
  readonly peakIdx: number | null;
  readonly cells: readonly Cell[];
}

interface HeatmapResponse {
  readonly days: number;
  readonly rows: readonly Row[];
  readonly generatedAt: string;
}

function buildResponse(opts: {
  readonly days?: number;
  readonly counts?: ReadonlyArray<ReadonlyArray<number>>;
  readonly peakIdxs?: ReadonlyArray<number | null>;
}): HeatmapResponse {
  const days = opts.days ?? 30;
  const baseDate = new Date('2026-05-12T00:00:00Z');
  const rows: Row[] = SUBJECTS.map((subject, rowIdx) => {
    const rowCounts = opts.counts?.[rowIdx] ?? Array.from({ length: days }, () => 0);
    const cells: Cell[] = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(baseDate);
      d.setUTCDate(baseDate.getUTCDate() - (days - 1 - idx));
      const count = rowCounts[idx] ?? 0;
      return {
        date: d.toISOString().slice(0, 10),
        count,
        rate: count > 0 ? 0.5 : null,
      };
    });
    const total = cells.reduce((a, c) => a + c.count, 0);
    return {
      subject,
      total,
      peakIdx: opts.peakIdxs?.[rowIdx] ?? null,
      cells,
    };
  });
  return { days, rows, generatedAt: '2026-05-12T00:00:00Z' };
}

describe('WrongBookHeatmap', () => {
  it('renders 5 rows × 30 cols grid (default days=30)', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', () =>
        HttpResponse.json(buildResponse({ days: 30 })),
      ),
    );

    renderWithProviders(<WrongBookHeatmap />);

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-heatmap-grid')).toBeInTheDocument();
    });

    // 5 rowheader (subject label)
    for (const subject of SUBJECTS) {
      const row = screen.getByTestId(`heatmap-row-${subject}`);
      expect(row).toBeInTheDocument();
    }

    // 5 × 30 = 150 cells (data-count attribute matches)
    const allCells = screen.getAllByRole('gridcell');
    expect(allCells).toHaveLength(150);

    // 每行第 0 cell + 第 29 cell 都存在
    expect(
      screen.getByTestId('heatmap-cell-言语-0'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('heatmap-cell-常识-29'),
    ).toBeInTheDocument();
  });

  it('today cell (col idx=29) has ring-accent class', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', () =>
        HttpResponse.json(buildResponse({ days: 30 })),
      ),
    );

    renderWithProviders(<WrongBookHeatmap />);

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-heatmap-grid')).toBeInTheDocument();
    });

    const todayCell = screen.getByTestId('heatmap-cell-言语-29');
    expect(todayCell).toHaveAttribute('data-today', '1');
    expect(todayCell.className).toContain('ring-accent');

    // 非今日 cell 不带 ring-accent / data-today
    const earlierCell = screen.getByTestId('heatmap-cell-言语-0');
    expect(earlierCell).not.toHaveAttribute('data-today');
    expect(earlierCell.className).not.toContain('ring-accent');
  });

  it('peak cell (peakIdx=15) has data-peak attr + inset shadow', async () => {
    const counts: number[][] = SUBJECTS.map(() => Array.from({ length: 30 }, () => 0));
    counts[1][15] = 5; // 数量行 idx=15 cell count=5
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', () =>
        HttpResponse.json(
          buildResponse({
            days: 30,
            counts,
            peakIdxs: [null, 15, null, null, null],
          }),
        ),
      ),
    );

    renderWithProviders(<WrongBookHeatmap />);

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-heatmap-grid')).toBeInTheDocument();
    });

    const peakCell = screen.getByTestId('heatmap-cell-数量-15');
    expect(peakCell).toHaveAttribute('data-peak', '1');
    // peak 走 inline style 设 boxShadow inset 1.5px ink (cellBgClass 是 data-3)
    expect(peakCell.getAttribute('style')).toContain('inset 0 0 0 1.5px');

    // 非 peak cell 不带 data-peak
    const otherCell = screen.getByTestId('heatmap-cell-言语-15');
    expect(otherCell).not.toHaveAttribute('data-peak');
  });

  it('loading state → skeleton renders before data arrives', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', async () => {
        await delay(50);
        return HttpResponse.json(buildResponse({ days: 30 }));
      }),
    );

    renderWithProviders(<WrongBookHeatmap />);

    expect(
      screen.getByTestId('wrong-book-heatmap-skeleton'),
    ).toBeInTheDocument();

    // 等数据到位后 skeleton 消失, grid 出现
    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-heatmap-grid')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('wrong-book-heatmap-skeleton'),
    ).not.toBeInTheDocument();
  });

  it('error state → QueryBoundary EmptyState + retry button', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', () =>
        HttpResponse.json({ detail: 'server_error' }, { status: 500 }),
      ),
    );

    // QueryClient 测试 default retry=false (renderWithProviders), 但 hook
    // 显式 retry: shouldRetry 覆盖了 default. 5xx 走 2 次 retry, 共 3 次
    // 请求 → 测试 waitFor 默认 1000ms 不够, 显式给 5s.
    renderWithProviders(<WrongBookHeatmap />);

    await waitFor(
      () => {
        expect(
          screen.getByTestId('wrong-book-heatmap-retry'),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-tone', 'error');
    expect(alert).toHaveTextContent('热图加载失败');
  });

  it('empty data (全 0 cells) → 5 rows still rendered, no peak triangle', async () => {
    server.use(
      http.get('/api/v2/practice/wrong-questions/heatmap', () =>
        HttpResponse.json(buildResponse({ days: 30 })),
      ),
    );

    renderWithProviders(<WrongBookHeatmap />);

    await waitFor(() => {
      expect(screen.getByTestId('wrong-book-heatmap-grid')).toBeInTheDocument();
    });

    // 5 行 × 30 cell 全部渲染 (grid 不错位)
    for (const subject of SUBJECTS) {
      const row = screen.getByTestId(`heatmap-row-${subject}`);
      // 每行 30 cell + 1 rowheader; getAllByRole within only finds gridcell.
      const cells = within(row).getAllByRole('gridcell');
      expect(cells).toHaveLength(30);
      // 全 0 → 全 bg-data-0
      for (const cell of cells) {
        expect(cell.className).toContain('bg-data-0');
        expect(cell).not.toHaveAttribute('data-peak');
      }
    }

    // 全行 peakIdx=null → 没有 data-peak attr 在任何 cell
    const allCells = screen.getAllByRole('gridcell');
    const peakCells = allCells.filter((c) => c.hasAttribute('data-peak'));
    expect(peakCells).toHaveLength(0);
  });
});
