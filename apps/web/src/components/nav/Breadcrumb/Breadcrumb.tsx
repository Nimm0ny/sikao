import type { ReactElement, ReactNode } from 'react';
import styles from './Breadcrumb.module.css';

/*
 * Breadcrumb — V5 D.3.25 nav primitive (skeleton).
 *
 * Why: hierarchical trail above page titles ("首页 / 题库 / 行测题目"). Last
 *      item renders as static span (current page); earlier items render as
 *      <a> when href is provided, else span. Default separator is an inline
 *      chevron-right SVG (V5-M4 sprite swap target).
 *
 *      maxItems collapses long trails to "first / ... / last(maxItems-2)".
 *      Mobile (≤768px) hides the breadcrumb entirely per spec D.3.25 — the
 *      TopBar back button replaces it.
 */

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
  readonly icon?: ReactElement;
}

export interface BreadcrumbProps {
  readonly items: ReadonlyArray<BreadcrumbItem>;
  readonly separator?: ReactNode;
  readonly maxItems?: number;
}

interface DisplaySegment {
  readonly key: string;
  readonly kind: 'item' | 'ellipsis';
  readonly item?: BreadcrumbItem;
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildSegments(
  items: ReadonlyArray<BreadcrumbItem>,
  maxItems: number | undefined,
): ReadonlyArray<DisplaySegment> {
  if (maxItems === undefined || items.length <= maxItems || maxItems < 2) {
    return items.map((it, i) => ({ key: `i-${i}`, kind: 'item', item: it }));
  }
  const tailCount = Math.max(1, maxItems - 2);
  const head: DisplaySegment = { key: 'head', kind: 'item', item: items[0] };
  const ellipsis: DisplaySegment = { key: 'ellipsis', kind: 'ellipsis' };
  const tailItems = items.slice(items.length - tailCount).map((it, i) => ({
    key: `t-${i}`,
    kind: 'item' as const,
    item: it,
  }));
  return [head, ellipsis, ...tailItems];
}

export function Breadcrumb({
  items,
  separator,
  maxItems,
}: BreadcrumbProps) {
  if (items.length === 0) return null;
  const segments = buildSegments(items, maxItems);
  const sep = separator ?? <ChevronRight />;

  return (
    <nav role="navigation" aria-label="面包屑" className={styles.root}>
      <ol className={styles.list}>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <li key={seg.key} className={styles.li}>
              {seg.kind === 'ellipsis' ? (
                <span className={styles.ellipsis} aria-hidden="true">…</span>
              ) : seg.item !== undefined && seg.item.href !== undefined && !isLast ? (
                <a className={styles.link} href={seg.item.href}>
                  {seg.item.icon !== undefined ? <span className={styles.icon} aria-hidden="true">{seg.item.icon}</span> : null}
                  <span>{seg.item.label}</span>
                </a>
              ) : (
                <span
                  className={styles.current}
                  data-current={isLast || undefined}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {seg.item?.icon !== undefined ? <span className={styles.icon} aria-hidden="true">{seg.item.icon}</span> : null}
                  <span>{seg.item?.label ?? ''}</span>
                </span>
              )}
              {!isLast ? <span className={styles.separator} aria-hidden="true">{sep}</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
