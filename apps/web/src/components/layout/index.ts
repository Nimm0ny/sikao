/*
 * V5 layout layer barrel.
 *
 * Why: AppShell + Rail + Workspace land together as the SaaS-shell triplet
 *      (D.3.32). Caller imports the full set from `@/components/layout`
 *      to compose pages, and Rail's collapse state machine drives both the
 *      rail width and the workspace centering.
 */
export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';

export { Rail, RailBrand, RailCmd, RailNav, RailMe, RailToggleButton } from './Rail';
export type { RailProps, RailNavItem } from './Rail';

export { Workspace } from './Workspace';
export type { WorkspaceProps, WorkspaceMaxWidth } from './Workspace';
