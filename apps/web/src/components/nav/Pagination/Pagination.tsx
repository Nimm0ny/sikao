import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Select } from '../../form/Select';
import styles from './Pagination.module.css';

/*
 * Pagination — V5 D.3.24 nav primitive (skeleton).
 *
 * Why: 1-based page navigator. Two visual modes:
 *      - 紧凑 (default): `< 1 2 ... N >`, current ±2 + first/last.
 *      - 常规: same + size-changer Select (D.3.13) and/or jumper input.
 *
 *      We always render the page-number row; showSizeChanger / showJumper
 *      add right-aligned auxiliary controls. Pagination is wrapped in
 *      <nav role="navigation" aria-label="Pagination"> for SR discovery.
 */

const PAGE_SIZE_OPTIONS: ReadonlyArray<{ readonly value: number; readonly label: string }> = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' },
];

const ELLIPSIS = '\u2026';

export interface PaginationProps {
  readonly current: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onChange: (page: number, pageSize: number) => void;
  readonly showSizeChanger?: boolean;
  readonly showJumper?: boolean;
  readonly size?: 'sm' | 'md';
}

interface PageItem {
  readonly key: string;
  readonly kind: 'page' | 'ellipsis';
  readonly value?: number;
}

function buildPages(current: number, totalPages: number): ReadonlyArray<PageItem> {
  if (totalPages <= 1) {
    return [{ key: 'p-1', kind: 'page', value: 1 }];
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev !== 0 && p - prev > 1) {
      items.push({ key: `e-${prev}-${p}`, kind: 'ellipsis' });
    }
    items.push({ key: `p-${p}`, kind: 'page', value: p });
    prev = p;
  }
  return items;
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M10 3l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pagination({
  current,
  total,
  pageSize,
  onChange,
  showSizeChanger = false,
  showJumper = false,
  size = 'md',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrent = Math.min(Math.max(1, current), totalPages);
  const pages = buildPages(safeCurrent, totalPages);
  const [jumperValue, setJumperValue] = useState('');
  const reactId = useId();
  const jumperId = `pagination-jumper-${reactId}`;

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages || p === safeCurrent) return;
    onChange(p, pageSize);
  };

  const handleJumperKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const parsed = Number.parseInt(jumperValue, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(1, parsed), totalPages);
    setJumperValue('');
    onChange(clamped, pageSize);
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={styles.root}
      data-size={size}
    >
      <ul className={styles.list}>
        <li className={styles.item}>
          <button
            type="button"
            className={styles.btn}
            data-control="prev"
            disabled={safeCurrent <= 1}
            aria-label="上一页"
            onClick={() => goTo(safeCurrent - 1)}
          >
            <ChevronLeft />
          </button>
        </li>
        {pages.map((item) => (
          <li key={item.key} className={styles.item}>
            {item.kind === 'ellipsis' ? (
              <span className={styles.ellipsis} aria-hidden="true">{ELLIPSIS}</span>
            ) : (
              <button
                type="button"
                className={styles.btn}
                data-active={item.value === safeCurrent || undefined}
                aria-current={item.value === safeCurrent ? 'page' : undefined}
                aria-label={`第 ${item.value} 页`}
                onClick={() => item.value !== undefined && goTo(item.value)}
              >
                {item.value}
              </button>
            )}
          </li>
        ))}
        <li className={styles.item}>
          <button
            type="button"
            className={styles.btn}
            data-control="next"
            disabled={safeCurrent >= totalPages}
            aria-label="下一页"
            onClick={() => goTo(safeCurrent + 1)}
          >
            <ChevronRight />
          </button>
        </li>
      </ul>
      {showSizeChanger ? (
        <div className={styles.aux} data-testid="pagination-size-changer">
          <Select<number>
            value={pageSize}
            options={PAGE_SIZE_OPTIONS}
            size="sm"
            aria-label="每页条数"
            onChange={(next) => onChange(1, next)}
          />
        </div>
      ) : null}
      {showJumper ? (
        <div className={styles.aux}>
          <label htmlFor={jumperId} className={styles.jumperLabel}>跳至</label>
          <input
            id={jumperId}
            type="number"
            min={1}
            max={totalPages}
            className={styles.jumperInput}
            value={jumperValue}
            placeholder={String(safeCurrent)}
            aria-label="跳至指定页"
            data-testid="pagination-jumper-input"
            onChange={(e) => setJumperValue(e.target.value)}
            onKeyDown={handleJumperKey}
          />
          <span className={styles.jumperLabel}>页</span>
        </div>
      ) : null}
    </nav>
  );
}
