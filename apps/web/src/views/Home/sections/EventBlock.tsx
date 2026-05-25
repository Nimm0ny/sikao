import type { CSSProperties } from 'react';
import type { PlanEventReadV2 } from '@sikao/api-client/types/home';
import styles from './EventBlock.module.css';

/*
 * EventBlock — Home Section A shared event surface.
 *
 * Why: Today / Week / Month bodies (and future drag overlay / detail
 *      panel) render the same V5 event card. Lifted out of the inline
 *      Today / Week implementations so:
 *        1. Visual contract (category color, status modifier, time
 *           slot) is single-source.
 *        2. Each view positions the block at its own scale via the
 *           `style` prop (top/height in px).
 *        3. Density flag dims the time slot (Week column is too narrow
 *           to render the time text — we just hide it via data-density).
 *
 *      AGENT-H7: density type guard limits the data-density attr to a
 *      known union; the `?? defaultValue` pattern is avoided by only
 *      forwarding `compact` when the caller explicitly opts in.
 */

export type EventBlockDensity = 'comfortable' | 'compact';

export interface EventBlockProps {
  readonly event: PlanEventReadV2;
  readonly style: CSSProperties;
  readonly density?: EventBlockDensity;
  readonly testId?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeRange(startAt: string, endAt: string): string {
  const s = new Date(startAt);
  const e = new Date(endAt);
  return `${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export function EventBlock({ event, style, density = 'comfortable', testId }: EventBlockProps) {
  return (
    <article
      className={styles.root}
      data-testid={testId}
      data-category={event.category}
      data-status={event.status}
      data-density={density === 'compact' ? 'compact' : undefined}
      style={style}
      title={event.title}
    >
      <div className={styles.title}>{event.title}</div>
      <div className={styles.time}>{formatTimeRange(event.startAt, event.endAt)}</div>
    </article>
  );
}
