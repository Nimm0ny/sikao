// lint-allow-ui-copy: V5-M3.5 Phase 4 page skeleton — Rail nav labels are
// design tokens fixed by spec §D.4, not user-editable strings. ui-copy SSOT
// migration tracked under future Phase 6+.
import { useCallback, useMemo, useState } from 'react';
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
import { CommandPalette } from '../../components/overlay';
import type { CommandPaletteGroup } from '../../components/overlay';
import { KeyboardShortcuts } from '../../components/system';
import type { ShortcutEntry } from '../../components/system';
import { RAIL_CMD } from '@/lib/ui-copy';
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
 * SIK-121 W2 (2026-05-25): cmd-k surface (H05). RootLayout owns the
 * CommandPalette open state and injects the rail trigger via the
 * `cmd` slot. Both click-on-trigger and Ctrl/Meta+K open the same
 * <CommandPalette>. The palette groups list lives here so future
 * commands can be wired without touching Rail.
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

  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

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

  // Cmd-k Ctrl/Meta+K shortcut — palette open is owned at layout scope so
  // mounting <KeyboardShortcuts> inside RootLayout (not Rail) keeps the
  // listener tied to the same lifecycle as the palette state.
  const cmdShortcuts: readonly ShortcutEntry[] = useMemo(() => [
    { keys: ['Control', 'k'], handler: openPalette, description: '打开命令面板' },
    { keys: ['Meta', 'k'], handler: openPalette, description: '打开命令面板 (mac)' },
  ], [openPalette]);

  // Initial palette command set is intentionally minimal — the 4 nav
  // jumps + open Me. Future commands (search note, jump to question)
  // are appended here; CommandPalette filters by label substring.
  const paletteGroups: readonly CommandPaletteGroup[] = useMemo(() => [
    {
      label: '导航',
      items: [
        { id: 'cmd-go-home', label: '首页', onSelect: () => navigate(HOME_PATH) },
        { id: 'cmd-go-practice', label: '练习', onSelect: () => navigate(PRACTICE_PATH) },
        { id: 'cmd-go-review', label: '复盘', onSelect: () => navigate(REVIEW_PATH) },
        { id: 'cmd-go-note', label: '笔记', onSelect: () => navigate(NOTE_PATH) },
        { id: 'cmd-go-me', label: '我的', onSelect: () => navigate(ME_PATH) },
      ],
    },
  ], [navigate]);

  const brand: ReactNode = (
    <span className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true" data-testid="rail-brand-mark">
        {/* BrandMark — inline JSX SVG, single SSOT mirror of
         * apps/web/public/favicon.svg (黑底圆角 + 白「田」6 stroke + 白圆点).
         * Why inline (not SpriteIcon): sprite system enforces 24×24 viewBox
         * + stroke-only contract via lint-icon-style (CP.5); brand mark is
         * a filled glyph on a 40×40 viewBox token-themed via currentColor /
         * background. lint-icon-style scans .svg files only, so inline JSX
         * <svg> is exempt by scope (verified 2026-05-26).
         */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 40 40"
          focusable="false"
          aria-hidden="true"
        >
          <rect width="40" height="40" rx="10" fill="currentColor" />
          <g
            className={styles.brandMarkInk}
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <line x1="11" y1="13" x2="29" y2="13" />
            <line x1="11" y1="22" x2="29" y2="22" />
            <line x1="11" y1="13" x2="11" y2="27" />
            <line x1="20" y1="13" x2="20" y2="27" />
            <line x1="29" y1="13" x2="29" y2="27" />
            <line x1="11" y1="27" x2="29" y2="27" />
          </g>
          <circle cx="20" cy="34" r="2.2" className={styles.brandMarkDot} />
        </svg>
      </span>
      <span className={styles.brandWord}>SIKAO</span>
    </span>
  );

  // H05 cmd row: search icon + 命令搜索 placeholder text + ⌘K kbd hint;
  // collapsed state hides label + kbd via CSS (.cmdLabel / .cmdKbd).
  const cmd: ReactNode = (
    <button
      type="button"
      className={styles.cmdButton}
      aria-label={RAIL_CMD.searchLabel}
      data-testid="rail-cmd-btn"
      data-tip={RAIL_CMD.searchLabel}
      onClick={openPalette}
    >
      <SpriteIcon id="search" size={14} className={styles.cmdIcon} />
      <span className={styles.cmdLabel}>{RAIL_CMD.searchLabel}</span>
      <kbd className={styles.cmdKbd} aria-hidden="true">⌘K</kbd>
    </button>
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
    <Rail brand={brand} cmd={cmd} navItems={navItems} me={me} />
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
      <KeyboardShortcuts shortcuts={cmdShortcuts} />
      <Workspace maxWidth="workspace">
        <Outlet />
      </Workspace>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        groups={paletteGroups}
      />
    </AppShell>
  );
}

function getInitials(user: RootLayoutProps['user']): string {
  if (!user || user.displayName.length === 0) return '我';
  return user.displayName.slice(0, 1);
}

export type { RootLayoutProps };
