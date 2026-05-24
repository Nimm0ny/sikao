// lint-allow-ui-copy: V5-M3.5 Phase 4 page skeleton — Rail nav labels are
// design tokens fixed by spec §D.4, not user-editable strings. ui-copy SSOT
// migration tracked under future Phase 6+.
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  Rail,
  Workspace,
  MobileTopBar,
  BottomTabBar,
} from '../../components/layout';
import type { RailNavItem } from '../../components/layout';
import type { BottomTabBarItem } from '../../components/layout';
import { Avatar, SpriteIcon } from '../../components/atom';
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
 *      The layout also wires the mobile chrome (MobileTopBar + BottomTabBar)
 *      for <bp-md> breakpoints — AppShell handles the desktop/mobile DOM
 *      split internally via matchMedia, so we hand both slot trees in and
 *      AppShell decides which to render. The mobile tab bar items list
 *      lives here (5 tabs, design.md §D.5.2: 首页 / 练习 / 复盘 / 笔记 / 我的)
 *      because mobile exposes 我的 as the 5th bottom-tab whereas desktop
 *      hides it under RailMe.
 *
 *      Active tab is derived from the current URL pathname so deep links
 *      land correctly. Plain-click navigation goes through `useNavigate`
 *      so React state survives nav switches; modifier-clicks fall through
 *      to the native href so "open in new tab" still works.
 *
 *      Nav icons are sprite consumers via <SpriteIcon> — the build script
 *      `npm run build:icons -w @sikao/design-system` compiles
 *      `packages/design-system/src/icons/nav-*.svg` into the public sprite
 *      at `apps/web/public/icons.svg`. Each icon is rendered as
 *      <svg><use href="/icons.svg#nav-<key>" /></svg>.
 */

const HOME_PATH = '/';
const PRACTICE_PATH = '/practice';
const REVIEW_PATH = '/review';
const NOTE_PATH = '/note';
const QUESTION_HUB_PATH = '/question-hub';
const ME_PATH = '/me';

interface RootLayoutProps {
  readonly user?: {
    readonly displayName: string;
    readonly avatarSrc?: string;
  };
}

export function RootLayout({ user }: RootLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (target: string) =>
    target === HOME_PATH ? pathname === HOME_PATH : pathname.startsWith(target);
  const navTo = (path: string) => () => navigate(path);

  const navItems: RailNavItem[] = [
    { id: 'home', icon: <SpriteIcon id="nav-home" size={18} />, label: '首页', href: HOME_PATH, active: isActive(HOME_PATH), onClick: navTo(HOME_PATH) },
    { id: 'practice', icon: <SpriteIcon id="nav-practice" size={18} />, label: '练习', href: PRACTICE_PATH, active: isActive(PRACTICE_PATH), onClick: navTo(PRACTICE_PATH) },
    { id: 'review', icon: <SpriteIcon id="nav-review" size={18} />, label: '复盘', href: REVIEW_PATH, active: isActive(REVIEW_PATH), onClick: navTo(REVIEW_PATH) },
    { id: 'note', icon: <SpriteIcon id="nav-note" size={18} />, label: '笔记', href: NOTE_PATH, active: isActive(NOTE_PATH), onClick: navTo(NOTE_PATH) },
    { id: 'question', icon: <SpriteIcon id="nav-question" size={18} />, label: '题库', href: QUESTION_HUB_PATH, active: isActive(QUESTION_HUB_PATH), onClick: navTo(QUESTION_HUB_PATH) },
  ];

  const tabBarItems: BottomTabBarItem[] = [
    { id: 'home', icon: <SpriteIcon id="nav-home" size={18} />, label: '首页', href: HOME_PATH, active: isActive(HOME_PATH) },
    { id: 'practice', icon: <SpriteIcon id="nav-practice" size={18} />, label: '练习', href: PRACTICE_PATH, active: isActive(PRACTICE_PATH) },
    { id: 'review', icon: <SpriteIcon id="nav-review" size={18} />, label: '复盘', href: REVIEW_PATH, active: isActive(REVIEW_PATH) },
    { id: 'note', icon: <SpriteIcon id="nav-note" size={18} />, label: '笔记', href: NOTE_PATH, active: isActive(NOTE_PATH) },
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
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigate(ME_PATH);
      }}
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

