import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekStripCalendar } from '../WeekStripCalendar';
import type { HeatmapEntryV2 } from '@sikao/api-client/types/api';

// helper — 造 7 天 entries, ASC by date, entries[6].date = anchorISO (传入).
// counts[i] / rates[i] 跟 entries[i] 一一对应 (i=0 最早, i=6 = anchor).
function makeEntries(
  anchorISO: string,
  counts: readonly number[],
  rates: readonly number[] = counts.map(() => 0),
): HeatmapEntryV2[] {
  if (counts.length !== 7) throw new Error('test helper: counts must be length 7');
  const out: HeatmapEntryV2[] = [];
  const anchor = new Date(`${anchorISO}T00:00:00Z`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - (6 - i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    out.push({ date: `${y}-${m}-${dd}`, count: counts[i], rate: rates[i] });
  }
  return out;
}

describe('WeekStripCalendar', () => {
  beforeEach(() => {
    // freeze "today" to a known date so today-emphasis test is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 7 columns + summary for normal data', () => {
    const entries = makeEntries('2026-05-11', [0, 3, 8, 0, 15, 0, 2]);
    render(<WeekStripCalendar entries={entries} />);

    expect(screen.getByTestId('week-strip-calendar')).toBeInTheDocument();
    // 7 columns rendered
    for (let i = 0; i < 7; i += 1) {
      expect(screen.getByTestId(`week-strip-col-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`week-strip-cell-${i}`)).toBeInTheDocument();
    }
    // summary: total = 0+3+8+0+15+0+2 = 28, days w/ practice = 4
    const summary = screen.getByTestId('week-strip-summary');
    expect(summary).toHaveTextContent('本周练习');
    expect(summary).toHaveTextContent('28');
    expect(summary).toHaveTextContent('4');
    expect(summary).toHaveTextContent('天有练习');
  });

  it('renders empty state (all counts 0)', () => {
    const entries = makeEntries('2026-05-11', [0, 0, 0, 0, 0, 0, 0]);
    render(<WeekStripCalendar entries={entries} />);

    const summary = screen.getByTestId('week-strip-summary');
    expect(summary).toHaveTextContent('本周练习');
    expect(summary).toHaveTextContent('0');
    expect(summary).toHaveTextContent('0');
    expect(summary).toHaveTextContent('天有练习');
    // every cell uses the count=0 tone class
    for (let i = 0; i < 7; i += 1) {
      const cell = screen.getByTestId(`week-strip-cell-${i}`);
      expect(cell.className).toContain('bg-surface-alt');
    }
  });

  it('marks today column when entries[6].date matches today', () => {
    // today is frozen at 2026-05-11
    const entries = makeEntries('2026-05-11', [0, 0, 0, 0, 0, 0, 1]);
    render(<WeekStripCalendar entries={entries} />);

    const todayCol = screen.getByTestId('week-strip-col-6');
    expect(todayCol.getAttribute('data-today')).toBe('true');
    const todayCell = screen.getByTestId('week-strip-cell-6');
    expect(todayCell.className).toContain('outline');
    expect(todayCell.className).toContain('outline-accent');

    // earlier columns should not be flagged today
    for (let i = 0; i < 6; i += 1) {
      const col = screen.getByTestId(`week-strip-col-${i}`);
      expect(col.getAttribute('data-today')).toBe('false');
      const cell = screen.getByTestId(`week-strip-cell-${i}`);
      expect(cell.className).not.toContain('outline-accent');
    }
  });

  it('does not flag any column when entries[6].date is not today', () => {
    // entries end 2026-05-10 (yesterday vs frozen 2026-05-11)
    const entries = makeEntries('2026-05-10', [0, 0, 0, 0, 0, 0, 0]);
    render(<WeekStripCalendar entries={entries} />);

    for (let i = 0; i < 7; i += 1) {
      const col = screen.getByTestId(`week-strip-col-${i}`);
      expect(col.getAttribute('data-today')).toBe('false');
    }
  });

  it('applies tone-class ladder for count thresholds (0 / 1-5 / 6-10 / 11-20 / >20)', () => {
    // counts: [0, 1, 8, 15, 25, 5, 10]
    const entries = makeEntries('2026-05-11', [0, 1, 8, 15, 25, 5, 10]);
    render(<WeekStripCalendar entries={entries} />);

    expect(screen.getByTestId('week-strip-cell-0').className).toContain('bg-surface-alt');
    expect(screen.getByTestId('week-strip-cell-1').className).toContain('bg-paper-3');
    expect(screen.getByTestId('week-strip-cell-2').className).toContain('bg-line-3');
    expect(screen.getByTestId('week-strip-cell-3').className).toContain('bg-ink-3');
    expect(screen.getByTestId('week-strip-cell-4').className).toContain('bg-ink');
    expect(screen.getByTestId('week-strip-cell-5').className).toContain('bg-paper-3');
    expect(screen.getByTestId('week-strip-cell-6').className).toContain('bg-line-3');
  });

  it('throws if entries.length is not 7', () => {
    const six: HeatmapEntryV2[] = [
      { date: '2026-05-06', count: 0, rate: 0 },
      { date: '2026-05-07', count: 0, rate: 0 },
      { date: '2026-05-08', count: 0, rate: 0 },
      { date: '2026-05-09', count: 0, rate: 0 },
      { date: '2026-05-10', count: 0, rate: 0 },
      { date: '2026-05-11', count: 0, rate: 0 },
    ];
    // suppress React error logging for expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<WeekStripCalendar entries={six} />)).toThrow(
      /entries\.length must be exactly 7/,
    );
    spy.mockRestore();
  });

  it('forwards className prop', () => {
    const entries = makeEntries('2026-05-11', [0, 0, 0, 0, 0, 0, 0]);
    render(<WeekStripCalendar entries={entries} className="custom-test-class" />);
    expect(screen.getByTestId('week-strip-calendar').className).toContain('custom-test-class');
  });

  it('renders CJK weekday labels (一 二 三 四 五 六 日)', () => {
    const entries = makeEntries('2026-05-11', [0, 0, 0, 0, 0, 0, 0]);
    render(<WeekStripCalendar entries={entries} />);
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
