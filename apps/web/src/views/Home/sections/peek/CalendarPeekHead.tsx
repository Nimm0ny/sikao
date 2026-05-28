// lint-allow-ui-copy: SIK-138 W6 Peek head copy comes from visual contract
// §2 (Required Interactive Elements · Peek 顶 bar 6 按钮).
import { ChevronDown, ChevronUp, Copy, Maximize2, MoreHorizontal, X } from 'lucide-react';

import styles from './CalendarPeekCard.module.css';

/*
 * CalendarPeekHead — SIK-138 W6.
 *
 * Why: visual contract §2 locks exactly six buttons in the peek head bar:
 *      1. expand-as-page (placeholder, disabled in V1)
 *      2. prev (↑)
 *      3. next (↓)
 *      4. copy-link (placeholder, disabled in V1)
 *      5. more (placeholder, disabled in V1)
 *      6. close (✕)
 *      Plus a breadcrumb "Calendar · Home" on the left.
 *
 *      AGENT-H7 read-only: the four placeholder buttons render as visible
 *      but disabled; design.md V1 scope forbids wiring them to writes.
 *      Disabled state is the contract; do not silently turn them on.
 */

const CRUMB_LABEL = 'Calendar · Home';

export interface CalendarPeekHeadProps {
  readonly onClose: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly canStep: boolean;
  readonly currentIndex: number;
  readonly listLength: number;
}

export function CalendarPeekHead({
  onClose,
  onPrev,
  onNext,
  canStep,
  currentIndex,
  listLength,
}: CalendarPeekHeadProps) {
  return (
    <header className={styles.head} data-testid="home-calendar-peek-head">
      <button
        type="button"
        className={styles.headBtn}
        disabled
        aria-label="展开为页面（即将上线）"
        data-testid="home-calendar-peek-expand"
      >
        <Maximize2 className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
      <span className={styles.crumb} data-testid="home-calendar-peek-crumb">
        {CRUMB_LABEL}
      </span>
      <span className={styles.flex} aria-hidden="true" />
      <span
        className={styles.counter}
        aria-label={`第 ${currentIndex + 1} 项，共 ${listLength} 项`}
        data-testid="home-calendar-peek-counter"
      >
        {currentIndex + 1} / {listLength}
      </span>
      <button
        type="button"
        className={styles.headBtn}
        onClick={onPrev}
        disabled={!canStep}
        aria-label="上一条"
        data-testid="home-calendar-peek-prev"
      >
        <ChevronUp className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.headBtn}
        onClick={onNext}
        disabled={!canStep}
        aria-label="下一条"
        data-testid="home-calendar-peek-next"
      >
        <ChevronDown className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.headBtn}
        disabled
        aria-label="复制链接（即将上线）"
        data-testid="home-calendar-peek-copy"
      >
        <Copy className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.headBtn}
        disabled
        aria-label="更多操作（即将上线）"
        data-testid="home-calendar-peek-more"
      >
        <MoreHorizontal className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.headBtn}
        onClick={onClose}
        aria-label="关闭"
        data-testid="home-calendar-peek-close"
      >
        <X className={styles.headIcon} role="img" aria-hidden="true" />
      </button>
    </header>
  );
}
