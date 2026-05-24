/*
 * V5 layout layer barrel.
 *
 * Why: AppShell + Rail + Workspace land together as the SaaS-shell triplet
 *      (D.3.32). Panel + PageHeader + Section are the container triplet
 *      (D.3.33). MobileAppShell + MobileTopBar + BottomTabBar form the
 *      mobile chrome trio (D.3.32+ §3 mobile shell). Caller imports the
 *      full surface from `@/components/layout` to compose pages.
 */
export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';

export { Rail, RailBrand, RailCmd, RailNav, RailMe, RailToggleButton } from './Rail';
export type { RailProps, RailNavItem } from './Rail';

export { Workspace } from './Workspace';
export type { WorkspaceProps, WorkspaceMaxWidth } from './Workspace';

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { Section } from './Section';
export type { SectionProps, SectionSpacing } from './Section';

export { MobileAppShell } from './MobileAppShell';
export type { MobileAppShellProps } from './MobileAppShell';

export { MobileTopBar } from './MobileTopBar';
export type { MobileTopBarProps } from './MobileTopBar';

export { BottomTabBar } from './BottomTabBar';
export type { BottomTabBarProps, BottomTabBarItem } from './BottomTabBar';
