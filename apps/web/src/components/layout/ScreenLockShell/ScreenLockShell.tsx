import type { CSSProperties, ReactNode } from 'react';
import styles from './ScreenLockShell.module.css';

/*
 * ScreenLockShell — V5 entry view "single-screen lock" primitive.
 *
 * Why: Web-Layout.md §1 mandates entry views (Home / Profile* / Practice
 *      hub / Review / Note / Me) render in a strictly viewport-locked
 *      grid (height: 100dvh + overflow: hidden) with internal scroll
 *      regions, mirroring the prototype's `.ws { height: 100vh; overflow:
 *      hidden; display: grid }` model in `.tmp_review/out/_shared/v5-base.css`.
 *
 *      Entry views MUST wrap their content in this primitive instead of
 *      writing `min-height: 100vh` ad-hoc. `lint-screen-lock.mjs` enforces
 *      that white-listed view module.css files do not bypass it.
 *
 *      AGENT-H7: `rows` is required (no `?? defaultValue`). Caller must
 *      pass an explicit grid-template-rows string per its visual contract.
 *
 *      Use `<ScrollRegion>` for the row that owns internal scroll (typical:
 *      the main panel between header and bottom row).
 */

export interface ScreenLockShellProps {
  /**
   * grid-template-rows value, required.
   * Example: "auto auto minmax(0, 1.6fr) minmax(0, 1fr)"
   */
  readonly rows: string;
  /**
   * Optional grid-template-columns. Defaults to single column.
   */
  readonly columns?: string;
  /**
   * Gap between grid cells. Defaults to var(--space-4).
   */
  readonly gap?: string;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly testId?: string;
}

export function ScreenLockShell({
  rows,
  columns,
  gap,
  className,
  children,
  testId,
}: ScreenLockShellProps) {
  // CSS variables instead of `style.gridTemplateRows` so the lint rule that
  // bans inline grid declarations passes; CSS resolves --rows / --columns
  // / --gap in ScreenLockShell.module.css.
  const style = {
    '--screen-lock-rows': rows,
    ...(columns !== undefined ? { '--screen-lock-columns': columns } : {}),
    ...(gap !== undefined ? { '--screen-lock-gap': gap } : {}),
  } as CSSProperties;
  const cls = [styles.root, className].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={style}
      data-screen-lock="true"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/*
 * ScrollRegion — convention class for the single grid row that owns
 * internal scroll. Sets min-height: 0 + overflow: auto so flex/grid
 * descendants can shrink below content size correctly.
 */
export interface ScrollRegionProps {
  readonly className?: string;
  readonly children?: ReactNode;
  readonly testId?: string;
}

export function ScrollRegion({ className, children, testId }: ScrollRegionProps) {
  const cls = [styles.scrollRegion, className].filter(Boolean).join(' ');
  return (
    <div className={cls} data-scroll-region="true" data-testid={testId}>
      {children}
    </div>
  );
}
