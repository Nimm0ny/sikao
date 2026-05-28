import type { ReactNode } from 'react';
import styles from './Workspace.module.css';

/*
 * Workspace — V5 D.3.32 layout (skeleton).
 *
 * Why: right-side main content container that lives next to <Rail>. Owns the
 *      shared desktop canvas token. After SIK-128 Route A, default
 *      'workspace' means "fill the Rail-remaining width"; narrow reading /
 *      form ergonomics must use the explicit 'reading' / 'form' / 'prose'
 *      tokens. 'none' remains the escape hatch for a page that owns its own
 *      sizing contract entirely.
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
