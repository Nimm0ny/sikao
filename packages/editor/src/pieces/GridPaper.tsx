import { CELL, COLS, ROWS_PER_PAGE, type PlacedCell } from '@sikao/answer-engine/grid-layout/gridLayout';

interface Props {
  pageIdx: number;
  pageCount: number;
  cells: PlacedCell[];
  cursorRowInPage: number;
  cursorCol: number;
  isCursorPage: boolean;
  caretVisible: boolean;
  gridFontSize: number;
}

// SVG strokes consume the feature-local CSS vars defined in exam.css.
// Value-type is `string` (CSS var() expression) — browsers (Chrome/Edge 80+,
// FF 80+, Safari 14+) resolve var() inside SVG presentation attributes
// natively, so we don't need inline `style.stroke`.
const GRID_LINE = 'var(--exam-grid-line)';
const GRID_OUTER = 'var(--exam-grid-outer)';
const FAINT = 'var(--exam-grid-faint)';

// GridPaper — one page of the 田字格 sheet. SVG grid (lines + faint
// crosshairs in each cell) + absolute-positioned characters + a custom
// caret. Kept dumb on purpose: parent (AnswerArea) computes layout / cursor
// position via gridLayout.layoutText() and feeds it in.
//
// The 5-row tinted bands are decorative (~100-char ruler bands) and
// rendered as plain divs underneath the SVG, not part of the grid math.

export function GridPaper({
  pageIdx,
  pageCount,
  cells,
  cursorRowInPage,
  cursorCol,
  isCursorPage,
  caretVisible,
  gridFontSize,
}: Props) {
  const width = COLS * CELL;
  const height = ROWS_PER_PAGE * CELL;
  // ASCII characters render visually smaller than CJK in mixed-script
  // 田字格 — keep the 3pt offset that the original hardcode (15 vs 18)
  // captured. Floor at 11 so 14pt grids don't collapse ASCII to 11pt and
  // smaller.
  const asciiFontSize = Math.max(11, gridFontSize - 3);
  return (
    <div
      data-page={pageIdx}
      className="bg-surface rounded-card-lg border border-line shadow-card mb-6 p-5 relative"
      data-testid={`exam-gridpaper-page-${pageIdx}`}
    >
      {/* page header — page 1 has name / id placeholders, others say 承上页 → */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-line">
        {pageIdx === 0 ? (
          <div className="flex gap-4 text-tiny text-ink-3">
            <div>
              姓名
              <span className="inline-block w-16 border-b border-line-3 ml-2">&nbsp;</span>
            </div>
            <div>
              准考证号
              <span className="inline-block w-24 border-b border-line-3 ml-2">&nbsp;</span>
            </div>
          </div>
        ) : (
          <div className="text-tiny text-ink-4">承上页 →</div>
        )}
        <div className="text-tiny text-accent font-semibold tracking-wider">
          申论答题卡 · 第 {pageIdx + 1} 页
        </div>
      </div>

      {/* the actual grid */}
      <div
        className="relative mx-auto"
        style={{ width, height }}
        data-testid={`exam-gridpaper-grid-${pageIdx}`}
      >
        {/* every-5-row tinted bands (100-char ruler) */}
        {Array.from({ length: ROWS_PER_PAGE }, (_, r) => {
          const isHundred = (pageIdx * ROWS_PER_PAGE + r + 1) % 5 === 0;
          if (!isHundred) return null;
          return (
            <div
              key={`band-${r}`}
              className="absolute left-0 bg-surface-alt pointer-events-none"
              style={{ top: r * CELL, width, height: CELL }}
              aria-hidden
            />
          );
        })}

        <svg
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none"
          aria-hidden
        >
          {/* faint crosshairs inside each cell (田字格 verticals/horizontals) */}
          {Array.from({ length: ROWS_PER_PAGE }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => (
              <g key={`x-${r}-${c}`} opacity={0.25}>
                <line
                  x1={c * CELL + CELL / 2}
                  y1={r * CELL + 4}
                  x2={c * CELL + CELL / 2}
                  y2={r * CELL + CELL - 4}
                  stroke={FAINT}
                  strokeWidth={0.4}
                  strokeDasharray="1.5 2.5"
                />
                <line
                  x1={c * CELL + 4}
                  y1={r * CELL + CELL / 2}
                  x2={c * CELL + CELL - 4}
                  y2={r * CELL + CELL / 2}
                  stroke={FAINT}
                  strokeWidth={0.4}
                  strokeDasharray="1.5 2.5"
                />
              </g>
            )),
          )}
          {/* verticals */}
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <line
              key={`v-${i}`}
              x1={i * CELL}
              y1={0}
              x2={i * CELL}
              y2={height}
              stroke={i === 0 || i === COLS ? GRID_OUTER : GRID_LINE}
              strokeWidth={i === 0 || i === COLS ? 1.2 : 0.6}
            />
          ))}
          {/* horizontals */}
          {Array.from({ length: ROWS_PER_PAGE + 1 }, (_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * CELL}
              x2={width}
              y2={i * CELL}
              stroke={i === 0 || i === ROWS_PER_PAGE ? GRID_OUTER : GRID_LINE}
              strokeWidth={i === 0 || i === ROWS_PER_PAGE ? 1.2 : 0.6}
            />
          ))}
        </svg>

        {/* characters — keyed by row/col so a new character mounts a fresh
            div and triggers the inkFade keyframe once. The exam-ink-fade class
            (instead of inline animation) lets prefers-reduced-motion disable
            it via exam.css @media. */}
        {cells.map((c, i) => (
          <div
            key={`${pageIdx}-${i}-${c.row}-${c.col}`}
            className="absolute flex items-center justify-center select-none pointer-events-none font-serif exam-ink-fade"
            style={{
              left: c.col * CELL,
              top: c.row * CELL,
              width: CELL,
              height: CELL,
              fontSize: c.kind === 'ascii' ? asciiFontSize : gridFontSize,
              fontFamily: '"Kaiti SC","STKaiti","KaiTi","楷体",serif',
              color: 'var(--exam-ink)',
            }}
          >
            {c.char}
          </div>
        ))}

        {/* caret — only on the page the cursor is on, only when running + focused */}
        {isCursorPage && cursorRowInPage < ROWS_PER_PAGE && caretVisible && (
          <div
            className="absolute pointer-events-none rounded-tiny exam-cursor-blink"
            style={{
              left: cursorCol * CELL + 2,
              top: cursorRowInPage * CELL + 4,
              width: 1.5,
              height: CELL - 8,
              background: 'var(--exam-ink)',
            }}
            data-testid={`exam-gridpaper-caret-${pageIdx}`}
          />
        )}
      </div>

      {/* page footer */}
      <div className="mt-3 pt-2 border-t border-dashed border-line flex justify-between text-tiny text-ink-3 font-mono tabular-nums">
        <div>
          第 {pageIdx + 1} 页 · 共 {pageCount} 页
        </div>
        <div>
          {COLS} 格×{ROWS_PER_PAGE} 行 · {ROWS_PER_PAGE * COLS} 字/页
        </div>
      </div>
    </div>
  );
}
