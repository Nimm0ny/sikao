// lint-allow-ui-copy: V5-M3.5 Phase 4 page skeleton — Rail nav labels are
// design tokens fixed by spec §D.4, not user-editable strings. ui-copy SSOT
// migration tracked under future Phase 6+.
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  AppShell,
  Rail,
  Workspace,
  MobileTopBar,
  BottomTabBar,
} from '../../components/layout';
import type { RailNavItem } from '../../components/layout';
import type { BottomTabBarItem } from '../../components/layout';
import { Avatar } from '../../components/atom';
import styles from './RootLayout.module.css';

/*
 * RootLayout — V5 §D.4 SaaS shell wrapper (skeleton).
 *
 * Why: design.md §D.4 (line 1201) makes AppShell wrapping mandatory for
 *      every desktop page; Rail navItems order is fixed at
 *      [首页 / 练习 / 复盘 / 笔记 / 题库] and pages MUST NOT re-arrange. This
 *      RootLayout owns that contract once so individual <Page> views (Home,
 *      Practice, Note, Me, QuestionHub, Review) only render their inner
 *      grid via <Outlet />. "我的" is NOT in the navItems list — per §D.3.32
 *      design + §D.4 SaaS pattern, /me is reached through the RailMe avatar
 *      slot (R2/Q4 decision: avatar replaces 5th nav row).
 *
 *      The layout also wires the mobile chrome (MobileAppShell + MobileTopBar
 *      + BottomTabBar) for <bp-md> breakpoints — AppShell handles the
 *      desktop/mobile DOM split internally, but the tab bar items list
 *      lives here (5 tabs, design.md §D.5.2: 首页 / 练习 / 复盘 / 笔记 / 我的).
 *
 *      Active tab is derived from the current URL pathname so deep links
 *      land correctly. No router/state plumbing beyond this.
 */

// lint-allow-ui-copy: V5-M3.5 Phase 4 page skeleton — Rail nav labels are
// design tokens fixed by spec §D.4, not user-editable strings. ui-copy SSOT
// migration tracked under future Phase 6+.

const HOME_PATH = '/';
const PRACTICE_PATH = '/practice';
const REVIEW_PATH = '/review';
const NOTE_PATH = '/note';
const QUESTION_HUB_PATH = '/question-hub';
const ME_PATH = '/me';

interface NavIconProps {
  readonly d: string;
}
function NavIcon({ d }: NavIconProps) {
  // V5-M4 SIK-76 will swap these inline paths for the icon sprite. For
  // skeleton purposes a single-path SVG keeps lint-icon-style happy
  // (currentColor stroke, 18×18 viewBox per design §C.5.3 nav row).
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const NAV_ICONS = {
  home: 'M3 7.5 9 3l6 4.5V14.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M7 15.5V11h4v4.5',
  practice: 'M4 4h10v10H4Z M4 7.5h10 M7.5 4v10',
  review: 'M3 9a6 6 0 0 1 11-3 M15 9a6 6 0 0 1-11 3 M14 3v3h-3 M4 15v-3h3',
  note: 'M5 3h6l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M11 3v3h3 M6.5 9h5 M6.5 11.5h5',
  question: 'M9 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z M7 7.5a2 2 0 1 1 3 1.5c-1 .5-1 1.2-1 2 M9 12.5h.01',
} as const;

interface RootLayoutProps {
  readonly user?: {
    readonly displayName: string;
    readonly avatarSrc?: string;
  };
}

export function RootLayout({ user }: RootLayoutProps) {
  const { pathname } = useLocation();
  const isActive = (target: string) =>
    target === HOME_PATH ? pathname === HOME_PATH : pathname.startsWith(target);

  const navItems: RailNavItem[] = [
    { id: 'home', icon: <NavIcon d={NAV_ICONS.home} />, label: '首页', href: HOME_PATH, active: isActive(HOME_PATH) },
    { id: 'practice', icon: <NavIcon d={NAV_ICONS.practice} />, label: '练习', href: PRACTICE_PATH, active: isActive(PRACTICE_PATH) },
    { id: 'review', icon: <NavIcon d={NAV_ICONS.review} />, label: '复盘', href: REVIEW_PATH, active: isActive(REVIEW_PATH) },
    { id: 'note', icon: <NavIcon d={NAV_ICONS.note} />, label: '笔记', href: NOTE_PATH, active: isActive(NOTE_PATH) },
    { id: 'question', icon: <NavIcon d={NAV_ICONS.question} />, label: '题库', href: QUESTION_HUB_PATH, active: isActive(QUESTION_HUB_PATH) },
  ];

  const tabBarItems: BottomTabBarItem[] = [
    { id: 'home', icon: <NavIcon d={NAV_ICONS.home} />, label: '首页', href: HOME_PATH, active: isActive(HOME_PATH) },
    { id: 'practice', icon: <NavIcon d={NAV_ICONS.practice} />, label: '练习', href: PRACTICE_PATH, active: isActive(PRACTICE_PATH) },
    { id: 'review', icon: <NavIcon d={NAV_ICONS.review} />, label: '复盘', href: REVIEW_PATH, active: isActive(REVIEW_PATH) },
    { id: 'note', icon: <NavIcon d={NAV_ICONS.note} />, label: '笔记', href: NOTE_PATH, active: isActive(NOTE_PATH) },
    { id: 'me', icon: <Avatar fallback={getInitials(user)} size="xs" />, label: '我的', href: ME_PATH, active: isActive(ME_PATH) },
  ];

  const brand: ReactNode = (
    <span className={styles.brand}>
      <span className={styles.brandDot} aria-hidden="true" />
      <span className={styles.brandWord}>SIKAO</span>
    </span>
  );

  const me: ReactNode = (
    <a
      href={ME_PATH}
      className={styles.meLink}
      data-testid="rail-me-link"
      aria-current={isActive(ME_PATH) ? 'page' : undefined}
      aria-label="我的"
    >
      <Avatar
        src={user?.avatarSrc}
        fallback={getInitials(user)}
        alt={user?.displayName}
        size="sm"
      />
    </a>
  );

  const desktopRail = (
    <Rail brand={brand} navItems={navItems} me={me} />
  );

  const mobileTopBar = (
    <MobileTopBar title="思考" />
  );

  const mobileBottomNav = (
    <BottomTabBar items={tabBarItems} />
  );

  return (
    <AppShell
      rail={desktopRail}
      topbar={mobileTopBar}
      bottomNav={mobileBottomNav}
    >
      <Workspace maxWidth="workspace">
        <Outlet />
      </Workspace>
    </AppShell>
  );
}

function getInitials(user: RootLayoutProps['user']): string {
  if (!user || user.displayName.length === 0) return '我';
  return user.displayName.slice(0, 1);
}

export type { RootLayoutProps };

