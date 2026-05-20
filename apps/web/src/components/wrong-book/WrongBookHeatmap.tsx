/**
 * SIKAO Wave 5 · 错题本学习热图 (5 模块 × N 天).
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       MainPage .heat 区段 (行 386-473).
 *
 * 5 行 (言语/数量/判推/资分/常识, BE enum 短名固定) × N 列 (默认 30; ≤180 天).
 * cell 颜色映射: 0 → data-0; 1 → data-1; 2-3 → data-2; 4-6 → data-3;
 * 7-10 → data-4; >10 → data-5 (6 档 token, lhr 2026-05-12 批 §3.7).
 *
 * 三态由 QueryBoundary 收敛 (loading skeleton / error / data); 不在 component
 * 内做 `?? []` 兜底 — Fail-Fast (CLAUDE.md §4).
 *
 * Italic 政策: CJK 行 label / 数字 caption 一律 font-sans 无 italic; 仅 ASCII
 * 兜底箭头 / 数字 caption 走 font-serif 但不 italic.
 */
import { QueryBoundary } from '@/components/data';
import { Skeleton } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import {
  useWrongBookHeatmap,
  type HeatmapDays,
  type WrongBookHeatmapCell,
  type WrongBookHeatmapResponse,
  type WrongBookHeatmapRow,
} from '@sikao/domain/wrong-book/useWrongBookHeatmap';
import { WRONG_BOOK_COPY } from '@/lib/ui-copy';

const SUBJECT_ORDER = ['言语', '数量', '判推', '资分', '常识'] as const;
type SubjectShort = (typeof SUBJECT_ORDER)[number];

// 6 档 token bucket. 来源: docs/plan/sikao-module-xingce-wrongbook-2026-05-11.md
// 第 254 + 317-326 行 (data-* token 6 档, lhr 2026-05-12 批).
function cellBgClass(count: number): string {
  if (count <= 0) return 'bg-data-0';
  if (count === 1) return 'bg-data-1';
  if (count <= 3) return 'bg-data-2';
  if (count <= 6) return 'bg-data-3';
  if (count <= 10) return 'bg-data-4';
  return 'bg-data-5';
}

// count>=4 配深底 (data-3..5) 用浅 ink 描述; <=3 浅底用 ink-2.
function cellTextToneClass(count: number): string {
  return count >= 4 ? 'text-paper' : 'text-ink-2';
}

interface CellProps {
  readonly cell: WrongBookHeatmapCell;
  readonly subject: SubjectShort;
  readonly colIdx: number;
  readonly isToday: boolean;
  readonly isPeak: boolean;
}

function HeatCell({ cell, subject, colIdx, isToday, isPeak }: CellProps) {
  const ratePct =
    cell.rate !== null && cell.rate !== undefined
      ? Math.round(cell.rate * 100)
      : null;
  const ariaLabel =
    ratePct !== null
      ? `${subject} ${cell.date} 错 ${cell.count} 题 错误率 ${ratePct}%`
      : `${subject} ${cell.date} 错 ${cell.count} 题`;
  return (
    <button
      type="button"
      role="gridcell"
      data-testid={`heatmap-cell-${subject}-${colIdx}`}
      data-count={cell.count}
      data-today={isToday ? '1' : undefined}
      data-peak={isPeak ? '1' : undefined}
      title={ariaLabel}
      aria-label={ariaLabel}
      className={cn(
        'relative w-full h-[18px] rounded-1 transition-transform duration-fast',
        'hover:z-10 hover:scale-150 hover:outline hover:outline-1 hover:outline-accent',
        'focus:outline focus:outline-1 focus:outline-accent focus-visible:z-10',
        cellBgClass(cell.count),
        cellTextToneClass(cell.count),
        isToday && 'ring-1 ring-accent z-10',
      )}
      style={
        isPeak
          ? { boxShadow: 'inset 0 0 0 1.5px var(--ink-1)' }
          : undefined
      }
    >
      {isPeak ? (
        <span
          aria-hidden="true"
          className="absolute top-px right-px w-0 h-0"
          style={{
            borderTop: '5px solid var(--ink-1)',
            borderLeft: '5px solid transparent',
          }}
        />
      ) : null}
      {isToday ? (
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            bottom: '-6px',
            borderLeft: '3px solid transparent',
            borderRight: '3px solid transparent',
            borderTop: '4px solid var(--accent-1)',
          }}
        />
      ) : null}
    </button>
  );
}

interface HeatRowProps {
  readonly row: WrongBookHeatmapRow;
  readonly todayIdx: number;
}

function HeatRow({ row, todayIdx }: HeatRowProps) {
  return (
    <div
      role="row"
      className="contents"
      data-testid={`heatmap-row-${row.subject}`}
    >
      <div
        role="rowheader"
        className="flex items-center justify-between pr-2 h-[18px] text-xs font-sans font-medium text-ink-2"
      >
        <span>{row.subject}</span>
        <span className="font-mono text-tiny text-ink-4 tracking-loose">
          {row.total}
        </span>
      </div>
      {row.cells.map((cell, colIdx) => (
        <HeatCell
          key={`${row.subject}-${colIdx}`}
          cell={cell}
          subject={row.subject as SubjectShort}
          colIdx={colIdx}
          isToday={colIdx === todayIdx}
          isPeak={row.peakIdx !== null && row.peakIdx !== undefined && row.peakIdx === colIdx}
        />
      ))}
    </div>
  );
}

interface HeatmapBodyProps {
  readonly data: WrongBookHeatmapResponse;
}

function HeatmapBody({ data }: HeatmapBodyProps) {
  const days = data.days;
  const todayIdx = days - 1;
  // grid-template-columns 用 inline style 因为 days 是动态值 (7/30/90/180),
  // Tailwind JIT 没法在 build time 生成所有挡位 utility.
  //
  // SIKAO Wave 9 Phase 2b mobile responsive: 30 cell × 12px = 360px min cell
  // 区, +80px label col = 440px 最小内容宽. mobile (375-768) 内容 < 360px 时
  // overflow-x-auto wrapper 让 grid 横滚不破坏 cell 可读性. desktop 视宽 ≥1024
  // 仍 1:1 ratio 拉满.
  const minCellWidth = 12;
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `80px repeat(${days}, minmax(${minCellWidth}px, 1fr))`,
    columnGap: '2px',
    rowGap: '4px',
    alignItems: 'stretch',
    minWidth: `${80 + days * (minCellWidth + 2)}px`,
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        role="grid"
        aria-label="错题热图 5 模块 × N 天"
        data-testid="wrong-book-heatmap-grid"
        style={gridStyle}
      >
        {data.rows.map((row) => (
          <HeatRow key={row.subject} row={row} todayIdx={todayIdx} />
        ))}
      </div>
    </div>
  );
}

function HeatmapSkeleton({ days }: { readonly days: HeatmapDays }) {
  // mimic 5 行 × N cell + label 列 grid, 让 layout 不抖动.
  // testid 用 -inner suffix 让 QueryBoundary 的 ${testId}-skeleton 外层 div
  // 跟内层不撞 (QueryBoundary 自动包一层 data-testid="wrong-book-heatmap-skeleton",
  // 内层是 layout grid 本身).
  // SIKAO Wave 9 Phase 2b: 跟 HeatmapBody 同样 overflow-x-auto wrapper +
  // minmax(12px) 防 mobile 挤压, 让 skeleton → data 切换无 layout shift.
  const minCellWidth = 12;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        role="status"
        aria-busy="true"
        aria-label="加载热图"
        data-testid="wrong-book-heatmap-skeleton-inner"
        style={{
          display: 'grid',
          gridTemplateColumns: `80px repeat(${days}, minmax(${minCellWidth}px, 1fr))`,
          columnGap: '2px',
          rowGap: '4px',
          minWidth: `${80 + days * (minCellWidth + 2)}px`,
        }}
      >
        {SUBJECT_ORDER.flatMap((subject) => [
          <Skeleton
            key={`label-${subject}`}
            heightClass="h-[18px]"
            roundedClass="rounded-1"
          />,
          ...Array.from({ length: days }).map((_, colIdx) => (
            <Skeleton
              key={`${subject}-${colIdx}`}
              heightClass="h-[18px]"
              roundedClass="rounded-1"
            />
          )),
        ])}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  // 6 档色阶图例 (少 → 多). 文案对应 cellBgClass 阈值: ≤0 / 1 / 2-3 / 4-6 / 7-10 / 10+.
  const buckets: readonly { readonly bg: string; readonly label: string }[] = [
    { bg: 'bg-data-0', label: '0' },
    { bg: 'bg-data-1', label: '1' },
    { bg: 'bg-data-2', label: '2-3' },
    { bg: 'bg-data-3', label: '4-6' },
    { bg: 'bg-data-4', label: '7-10' },
    { bg: 'bg-data-5', label: '10+' },
  ];
  return (
    <div
      className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3 mt-4 pt-3 border-t border-line text-tiny font-mono text-ink-4 tracking-loose"
      data-testid="wrong-book-heatmap-legend"
    >
      <span>横轴 = 天 · 纵轴 = 5 模块 · 轴上点 = 当日峰值</span>
      <span className="flex items-center gap-2">
        少
        <span className="flex" style={{ gap: '2px' }}>
          {buckets.map((b) => (
            <span
              key={b.label}
              className={cn('inline-block w-[14px] h-[10px] rounded-1', b.bg)}
              title={`错题 ${b.label}`}
              aria-label={`错题 ${b.label}`}
            />
          ))}
        </span>
        多
      </span>
    </div>
  );
}

export interface WrongBookHeatmapProps {
  readonly days?: HeatmapDays;
}

export function WrongBookHeatmap({ days = 30 }: WrongBookHeatmapProps) {
  const query = useWrongBookHeatmap(days);
  return (
    <section
      className="bg-paper border border-line p-5 md:p-6 rounded-card"
      data-testid="wrong-book-heatmap"
      aria-label={WRONG_BOOK_COPY.heatmapTitle}
    >
      <header className="flex flex-col gap-2 md:flex-row md:justify-between md:items-baseline md:gap-3 mb-4">
        <h3 className="font-serif font-semibold text-base text-ink m-0">
          学习热图（最近 {days} 天）
        </h3>
        <span className="font-mono text-tiny text-ink-4 tracking-widest uppercase">
          深 = 错题多 · 轴上点 = 当日峰值
        </span>
      </header>

      <QueryBoundary
        query={query}
        testId="wrong-book-heatmap"
        skeleton={<HeatmapSkeleton days={days} />}
        errorTitle={WRONG_BOOK_COPY.heatmapErrorTitle}
        errorDescription={`${WRONG_BOOK_COPY.heatmapErrorDesc}.`}
      >
        {(data) => (
          <>
            <HeatmapBody data={data} />
            <HeatmapLegend />
          </>
        )}
      </QueryBoundary>
    </section>
  );
}
