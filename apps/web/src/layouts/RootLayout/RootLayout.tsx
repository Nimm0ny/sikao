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
 * RootLayout — V5 §D.4 SaaS shell wrapper.
 *
 * SIK-121 W1 (2026-05-25): nav收敛到 4-tab [首页 / 练习 / 复盘 / 笔记],
 * 「我的」入口仅由 RailMe 头像（左下角）提供，不再单独占 nav 槽位 — 防止
 * 任何 Tab1 子 issue 从原型 HTML 数 5-tab 再犯错。详见
 * docs/plan/sik-rail-v5-visual-contract.md §1–§2 + Acceptance Hooks
 * H01/H02。原型 home-frame.html 的 .rail-bottom 也仅有 .rail-me 一段，
 * 与本实现一致。展开态 RailMe 渲染 Avatar + meStack(meName + meSub)；
 * 折叠态由 Rail.tsx 的 [data-tip="我的"] ::after Tooltip 提供文字提示。
 *
 * Mobile chrome (MobileTopBar + BottomTabBar) wires the same 4 tabs;
 * mobile 「我的」 入口 walks /me directly via top-bar trailing avatar
 * (separate spec) — BottomTabBar 也只有 4 项。
 *
 * Active tab derives from URL pathname so deep links land correctly.
 * Plain-click navigation goes through useNavigate; modifier-clicks fall
 * through to native href for "open in new tab".
 *
 * Nav icons are sprite consumers via <SpriteIcon>.
 */

const HOME_PATH = '/';
const PRACTICE_PATH = '/practice';
const REVIEW_PATH = '/review';
const NOTE_PATH = '/note';
const ME_PATH = '/me';

interface RootLayoutProps {
  readonly user?: {
    readonly displayName: string;
    readonly avatarSrc?: string;
    readonly subtitle?: string;
  };
}

const ME_SUBTITLE_FALLBACK = 'Lv.4 学习达人';

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
  ];

  const tabBarItems: BottomTabBarItem[] = [
    { id: 'home', icon: <SpriteIcon id="nav-home" size={18} />, label: '首页', href: HOME_PATH, active: isActive(HOME_PATH) },
    { id: 'practice', icon: <SpriteIcon id="nav-practice" size={18} />, label: '练习', href: PRACTICE_PATH, active: isActive(PRACTICE_PATH) },
    { id: 'review', icon: <SpriteIcon id="nav-review" size={18} />, label: '复盘', href: REVIEW_PATH, active: isActive(REVIEW_PATH) },
    { id: 'note', icon: <SpriteIcon id="nav-note" size={18} />, label: '笔记', href: NOTE_PATH, active: isActive(NOTE_PATH) },
  ];

  const brand: ReactNode = (
    <span className={styles.brand}>
      <span className={styles.brandDot} aria-hidden="true" />
      <span className={styles.brandWord}>SIKAO</span>
    </span>
  );

  const meName = user?.displayName ?? '我';
  const meSub = user?.subtitle ?? ME_SUBTITLE_FALLBACK;
  const me: ReactNode = (
    <a
      href={ME_PATH}
      className={styles.meLink}
      data-testid="rail-me-link"
      data-tip="我的"
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
      <span className={styles.meStack}>
        <span className={styles.meName}>{meName}</span>
        <span className={styles.meSub}>{meSub}</span>
      </span>
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

