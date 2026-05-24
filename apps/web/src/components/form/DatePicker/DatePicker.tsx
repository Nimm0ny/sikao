import { useMemo, useState } from 'react';
import { Popover } from '../../overlay/Popover';
import styles from './DatePicker.module.css';

/*
 * DatePicker — V5 D.3.14 form atom (skeleton).
 *
 * Why: date selection driven by a Popover-mounted calendar panel. Visual
 *      contract reuses --input-* token chrome on the trigger so DatePicker
 *      stacks visually agree with Input / Select. Format helper is inlined
 *      to avoid date-fns/luxon dependency at the atom layer; the supported
 *      format whitelist is explicit ('YYYY-MM-DD' | 'YYYY/MM/DD' | 'MM/DD').
 *
 * Calendar grid:
 *   - 7 columns (Mon-Sun, ISO week start).
 *   - Always 6 rows (42 cells) so the panel height never jumps when the
 *     month changes — UX gotcha called out in §D.3.35.
 *   - Out-of-month cells are dimmed; min/max disable cells out of range.
 *
 * Presets:
 *   - 默认包含 "今天" / "明天" / "下周一". Spec mentions a fourth "考试日"
 *     preset but explicitly defers it to business injection (the atom layer
 *     stays domain-agnostic).
 */

export type DateFormat = 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'MM/DD';

export interface DatePickerPreset {
  readonly label: string;
  readonly value: Date | (() => Date);
}

export interface DatePickerProps {
  readonly value: Date | null;
  readonly onChange: (v: Date | null) => void;
  readonly min?: Date;
  readonly max?: Date;
  readonly placeholder?: string;
  readonly format?: DateFormat;
  readonly presets?: ReadonlyArray<DatePickerPreset>;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function formatDate(d: Date, fmt: DateFormat): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  if (fmt === 'YYYY/MM/DD') return `${y}/${m}/${day}`;
  return `${m}/${day}`;
}

function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function nextMonday(from: Date): Date {
  const d = startOfDay(from);
  // 1 = Monday; getDay returns 0..6 with 0=Sunday
  const dayIdx = d.getDay() === 0 ? 7 : d.getDay();
  const diff = 8 - dayIdx; // days until next Monday (always at least 1)
  d.setDate(d.getDate() + diff);
  return d;
}

function defaultPresets(): ReadonlyArray<DatePickerPreset> {
  return [
    { label: '今天', value: () => startOfDay(new Date()) },
    { label: '明天', value: () => { const d = startOfDay(new Date()); d.setDate(d.getDate() + 1); return d; } },
    { label: '下周一', value: () => nextMonday(new Date()) },
  ];
}

function buildGrid(year: number, month0: number): ReadonlyArray<Date> {
  // ISO Mon-start grid of 6×7 = 42 cells.
  const first = new Date(year, month0, 1);
  const firstDow = first.getDay() === 0 ? 7 : first.getDay(); // 1..7 Mon..Sun
  const start = new Date(year, month0, 1 - (firstDow - 1));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

function isOutOfRange(d: Date, min?: Date, max?: Date): boolean {
  const day = startOfDay(d).getTime();
  if (min !== undefined && day < startOfDay(min).getTime()) return true;
  if (max !== undefined && day > startOfDay(max).getTime()) return true;
  return false;
}

function resolvePreset(p: DatePickerPreset): Date {
  return typeof p.value === 'function' ? p.value() : p.value;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = '选择日期',
  format = 'YYYY-MM-DD',
  presets,
  disabled = false,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const cursor: Date = useMemo(() => value ?? startOfDay(new Date()), [value]);
  const [viewYear, setViewYear] = useState<number>(cursor.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(cursor.getMonth()); // 0-11
  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const effectivePresets = presets ?? defaultPresets();

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    if (next) {
      // re-anchor calendar to the current value or today every time we open
      setViewYear(cursor.getFullYear());
      setViewMonth(cursor.getMonth());
    }
  };

  const handlePick = (d: Date) => {
    if (isOutOfRange(d, min, max)) return;
    onChange(startOfDay(d));
    setOpen(false);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const trigger = (
    <button
      type="button"
      className={styles.trigger}
      data-disabled={disabled || undefined}
      data-open={open || undefined}
      data-empty={value === null || undefined}
      disabled={disabled}
      aria-label={ariaLabel ?? placeholder}
    >
      <span className={styles.label}>
        {value !== null ? formatDate(value, format) : placeholder}
      </span>
      <span className={styles.suffix} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
          <rect x="2" y="3" width="10" height="9" rx="1.5" />
          <path d="M5 1.5v3M9 1.5v3M2 6h10" />
        </svg>
      </span>
    </button>
  );

  return (
    <span className={styles.root}>
      <Popover open={open} onOpenChange={handleOpenChange} trigger={trigger} side="bottom" align="start">
        <div className={styles.panel} data-testid="datepicker-panel">
          {effectivePresets.length > 0 ? (
            <div className={styles.presetRow} role="group" aria-label="日期快捷">
              {effectivePresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={styles.presetBtn}
                  onClick={() => handlePick(resolvePreset(p))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.navRow}>
            <button type="button" className={styles.navBtn} aria-label="上一月" onClick={goPrevMonth}>‹</button>
            <span className={styles.navLabel}>{viewYear}年 {MONTH_LABELS[viewMonth]}月</span>
            <button type="button" className={styles.navBtn} aria-label="下一月" onClick={goNextMonth}>›</button>
          </div>

          <div className={styles.weekdayRow} aria-hidden="true">
            {WEEKDAY_LABELS.map((w) => <span key={w} className={styles.weekday}>{w}</span>)}
          </div>

          <div className={styles.grid} role="grid" aria-label="日期选择">
            {grid.map((d) => {
              const inMonth = d.getMonth() === viewMonth;
              const oor = isOutOfRange(d, min, max);
              const isSel = value !== null && isSameDay(d, value);
              const today = isSameDay(d, new Date());
              return (
                <button
                  key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                  type="button"
                  className={styles.dayCell}
                  data-out-of-month={!inMonth || undefined}
                  data-out-of-range={oor || undefined}
                  data-selected={isSel || undefined}
                  data-today={today || undefined}
                  disabled={oor}
                  onClick={() => handlePick(d)}
                  aria-label={formatDate(d, 'YYYY-MM-DD')}
                  aria-pressed={isSel}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </span>
  );
}
