import type { ReactNode } from 'react';
import styles from './Workspace.module.css';

/*
 * Workspace — V5 D.3.32 layout (skeleton).
 *
 * Why: right-side main content container that lives next to <Rail>. Owns the
 *      large-screen content cap (--max-w-workspace 1440px etc.) so pages
 *      can stay readable on 1920+ displays without manually wiring max-width
 *      everywhere. Default token is 'workspace'; 'reading' / 'form' / 'prose'
 *      hand off to the matching --max-w-* token; 'none' opts out (e.g. a page
 *      that owns its own grid).
 */

export type WorkspaceMaxWidth = 'workspace' | 'reading' | 'form' | 'prose' | 'none';

export interface WorkspaceProps {
  readonly maxWidth?: WorkspaceMaxWidth;
  readonly children: ReactNode;
}

export function Workspace({ maxWidth = 'workspace', children }: WorkspaceProps) {
  return (
    <main className={styles.workspace} data-max-width={maxWidth}>
      {children}
    </main>
  );
}
