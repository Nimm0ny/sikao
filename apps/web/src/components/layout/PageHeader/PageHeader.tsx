import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

/*
 * PageHeader — V5 D.3.33 container (skeleton).
 *
 * Why: page-top header band. Renders breadcrumb (optional) + a flex row with
 *      h1 title (left) and an actions slot (right) + an optional subtitle
 *      below. Wraps in <header> so each page contributes a single top
 *      landmark; AppShell is non-landmark, so this is the canonical page
 *      banner. No background — sits flush against Workspace surface.
 */

export interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly breadcrumb?: ReactNode;
  readonly actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className={styles.root} data-testid="page-header">
      {breadcrumb !== undefined ? (
        <div className={styles.breadcrumb} data-testid="page-header-breadcrumb">
          {breadcrumb}
        </div>
      ) : null}
      <div className={styles.main}>
        <h1 className={styles.title}>{title}</h1>
        {actions !== undefined ? (
          <div className={styles.actions} data-testid="page-header-actions">
            {actions}
          </div>
        ) : null}
      </div>
      {subtitle !== undefined ? (
        <p className={styles.subtitle} data-testid="page-header-subtitle">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
