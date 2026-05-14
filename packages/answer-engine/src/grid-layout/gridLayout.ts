// Grid layout — turn a string into placed cells for the 田字格 paper.
// Source of truth for COLS / ROWS_PER_PAGE / CELL is here, not the docs.
// History:
//   - FEATURES F4.6 originally specified 25 × 20 = 500 chars/page.
//   - v2-ink.jsx prototype shipped 20 × 18 = 360, so we followed source.
//   - 2026-05-01 (lhr): user E2E feedback called the 20-col grid too narrow;
//     promoted to 25 cols (450 chars/page). Rows stay at 18 — taller pages
//     would push Pager off-screen on shorter laptops.

export const COLS = 25;
export const ROWS_PER_PAGE = 18;
export const CELL = 26;

const ASCII_RE = /[A-Za-z0-9]/;

export interface PlacedCell {
  char: string;
  row: number;
  col: number;
  kind: 'cjk' | 'ascii';
}

export interface GridLayout {
  placed: PlacedCell[];
  cursorRow: number;
  cursorCol: number;
  cursorPage: number;
  cursorRowInPage: number;
  pageCount: number;
  placedByPage: PlacedCell[][];
}

export function layoutText(text: string, minWords: number): GridLayout {
  const placed: PlacedCell[] = [];
  let row = 0;
  let col = 0;

  for (const ch of text) {
    if (ch === '\n') {
      row += 1;
      col = 0;
      continue;
    }
    placed.push({ char: ch, row, col, kind: ASCII_RE.test(ch) ? 'ascii' : 'cjk' });
    col += 1;
    if (col >= COLS) {
      col = 0;
      row += 1;
    }
  }

  const cursorRow = row;
  const cursorCol = col;
  const usedRows = Math.max(cursorRow + 1, 1);
  const minPages = Math.max(2, Math.ceil(minWords / (COLS * ROWS_PER_PAGE)));
  const pageBoundary = Math.ceil(usedRows / ROWS_PER_PAGE) * ROWS_PER_PAGE - 3;
  const pageCount = Math.max(
    minPages,
    Math.ceil(usedRows / ROWS_PER_PAGE) + (cursorRow + 1 > pageBoundary ? 1 : 0),
  );

  const placedByPage: PlacedCell[][] = Array.from({ length: pageCount }, () => []);
  for (const c of placed) {
    const p = Math.floor(c.row / ROWS_PER_PAGE);
    if (p < pageCount) {
      placedByPage[p].push({ ...c, row: c.row % ROWS_PER_PAGE });
    }
  }

  const cursorPage = Math.floor(cursorRow / ROWS_PER_PAGE);
  const cursorRowInPage = cursorRow % ROWS_PER_PAGE;

  return { placed, cursorRow, cursorCol, cursorPage, cursorRowInPage, pageCount, placedByPage };
}

export function formatTime(sec: number): string {
  const safe = Math.max(0, sec);
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
