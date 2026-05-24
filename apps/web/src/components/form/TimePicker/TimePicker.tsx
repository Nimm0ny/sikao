import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '../../overlay/Popover';
import styles from './TimePicker.module.css';

/*
 * TimePicker — V5 D.3.14 form atom (skeleton).
 *
 * Why: Popover-mounted dual-column hour + minute panel. Internally value is
 *      always 24h ({h:0..23, m:0..59}); 12h is a display contract that maps
 *      hour list + AM/PM toggle on top of the same payload. Trigger reuses
 *      --input-* token chrome so visual stack agrees with Input / Select /
 *      DatePicker. minute = [0, step, 2*step, ...]. jsdom stubs
 *      scrollIntoView so the auto-scroll is a no-op in tests.
 */

export type TimeFormat = '24h' | '12h';
export type TimeStep = 5 | 10 | 15 | 30 | 60;
export interface TimeValue { readonly h: number; readonly m: number; }
export interface TimePickerProps {
  readonly value: TimeValue | null;
  readonly onChange: (v: TimeValue | null) => void;
  readonly step?: TimeStep;
  readonly format?: TimeFormat;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
const periodOf = (h: number): 'AM' | 'PM' => (h < 12 ? 'AM' : 'PM');
const dispH = (h: number): number => { const r = h % 12; return r === 0 ? 12 : r; };
// AM 12 → 0, AM 1..11 → 1..11; PM 12 → 12, PM 1..11 → 13..23.
const to24h = (d: number, p: 'AM' | 'PM'): number =>
  p === 'AM' ? (d === 12 ? 0 : d) : (d === 12 ? 12 : d + 12);
const formatLabel = (v: TimeValue, fmt: TimeFormat): string =>
  fmt === '12h' ? `${pad2(dispH(v.h))}:${pad2(v.m)} ${periodOf(v.h)}` : `${pad2(v.h)}:${pad2(v.m)}`;
const minuteList = (step: TimeStep): ReadonlyArray<number> => {
  const out: number[] = []; for (let m = 0; m < 60; m += step) out.push(m); return out;
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12: ReadonlyArray<number> = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function TimePicker({
  value, onChange, step = 15, format = '24h', disabled = false, 'aria-label': ariaLabel,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const minutes = useMemo(() => minuteList(step), [step]);
  const hours = format === '24h' ? HOURS_24 : HOURS_12;
  const period: 'AM' | 'PM' = value !== null ? periodOf(value.h) : 'AM';
  const hourSelRef = useRef<HTMLButtonElement | null>(null);
  const minSelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    hourSelRef.current?.scrollIntoView({ block: 'center' });
    minSelRef.current?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  const base: TimeValue = value ?? { h: 0, m: 0 };
  const pickHour = (raw: number) =>
    onChange({ h: format === '12h' ? to24h(raw, period) : raw, m: base.m });
  const pickMinute = (m: number) => onChange({ h: base.h, m });
  const togglePeriod = (next: 'AM' | 'PM') => {
    if (next === period) return;
    onChange({ h: to24h(dispH(base.h), next), m: base.m });
  };
  const isHourSelected = (raw: number): boolean =>
    value !== null && (format === '24h' ? value.h === raw : dispH(value.h) === raw);

  const trigger = (
    <button type="button" role="combobox" className={styles.trigger}
      data-disabled={disabled || undefined} data-open={open || undefined}
      data-empty={value === null || undefined}
      disabled={disabled} aria-label={ariaLabel ?? '选择时间'}
      aria-expanded={open ? true : false}
    >
      <span className={styles.label}>{value !== null ? formatLabel(value, format) : '选择时间'}</span>
      <span className={styles.suffix} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
          <circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 1.5" />
        </svg>
      </span>
    </button>
  );

  return (
    <span className={styles.root}>
      <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)} trigger={trigger} side="bottom" align="start">
        <div className={styles.panel} data-testid="timepicker-panel">
          <div className={styles.cols}>
            <div role="listbox" aria-label="小时" className={styles.col}>
              {hours.map((h) => {
                const sel = isHourSelected(h);
                return (
                  <button ref={sel ? hourSelRef : undefined} key={`h-${h}`} type="button" role="option"
                    aria-selected={sel ? true : false} className={styles.cell}
                    data-selected={sel || undefined} onClick={() => pickHour(h)}>{pad2(h)}</button>
                );
              })}
            </div>
            <div role="listbox" aria-label="分钟" className={styles.col}>
              {minutes.map((m) => {
                const sel = value !== null && value.m === m;
                return (
                  <button ref={sel ? minSelRef : undefined} key={`m-${m}`} type="button" role="option"
                    aria-selected={sel ? true : false} className={styles.cell}
                    data-selected={sel || undefined} onClick={() => pickMinute(m)}>{pad2(m)}</button>
                );
              })}
            </div>
          </div>
          {format === '12h' ? (
            <div className={styles.periodRow} role="group" aria-label="上午下午">
              {(['AM', 'PM'] as const).map((p) => (
                <button key={p} type="button" className={styles.periodBtn}
                  data-selected={period === p || undefined}
                  aria-pressed={period === p ? true : false}
                  onClick={() => togglePeriod(p)}>{p}</button>
              ))}
            </div>
          ) : null}
        </div>
      </Popover>
    </span>
  );
}
