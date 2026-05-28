// lint-allow-ui-copy: V5-M3.5 Phase 4 page skeleton — Rail nav labels are
// design tokens fixed by spec §D.4, not user-editable strings. ui-copy SSOT
// migration tracked under future Phase 6+.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import { CommandPalette, Popover } from '../../components/overlay';
import type { CommandPaletteGroup } from '../../components/overlay';
import { KeyboardShortcuts } from '../../components/system';
import type { ShortcutEntry } from '../../components/system';
import {
  ACCOUNT_NAV_ITEMS,
  getActiveAccountNavKey,
  isAccountFamilyPath,
} from '../../views/Me/accountNav';
import { useAuthStore } from '@sikao/domain';
import {
  useProgressOverview,
  useProgressWeeklySummary,
} from '@sikao/api-client/progressQueries';
import { RAIL_CMD } from '@/lib/ui-copy';
import { useCommandPaletteStore } from '@/lib/commandPalette';
import styles from './RootLayout.module.css';

/*
 * RootLayout — V5 §D.4 SaaS shell wrapper.
 *
 * SIK-121 W1/W5 (2026-05-25 / 2026-05-28): nav收敛到 4-tab [首页 / 练习 /
 * 复盘 / 笔记]；「我的」入口仍只由 RailMe 提供，但已从直达 /me 的 link
 * 收口为唯一 button trigger + account popover。账户地图 SSOT 位于
 * views/Me/accountNav.ts，供 RootLayout 与 Profile SubNav 共用，避免
 * 任意 Tab1 / Profile issue 再把 account 扩展面塞回 global nav。
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
 * Rail nav plain-click navigation goes through useNavigate; RailMe owns a
 * separate button-triggered account popover instead of native href behavior.
 *
 * Nav icons are sprite consumers via <SpriteIcon>.
 */

const HOME_PATH = '/';
const PRACTICE_PATH = '/practice';
const REVIEW_PATH = '/review';
const NOTE_PATH = '/note';
const ME_PATH = '/me';
const INTL_NUMBER = new Intl.NumberFormat('zh-CN');

interface RootLayoutProps {
  readonly user?: {
    readonly displayName: string;
    readonly avatarSrc?: string;
    readonly subtitle?: string;
    readonly email?: string | null;
  };
}

const ME_SUBTITLE_FALLBACK = 'Lv.4 学习达人';

const ACCOUNT_MENU_ICONS: Record<(typeof ACCOUNT_NAV_ITEMS)[number]['key'], string> = {
  overview: 'nav-home',
  info: 'info',
  goals: 'calendar',
  learning: 'trend',
  records: 'notebook',
  preferences: 'check',
  security: 'warning',
  settings: 'settings',
};

export function RootLayout({ user }: RootLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const isActive = (target: string) =>
    target === HOME_PATH ? pathname === HOME_PATH : pathname.startsWith(target);
  const navTo = (path: string) => () => navigate(path);

  const paletteOpen = useCommandPaletteStore((s) => s.open);
  const openPalette = useCommandPaletteStore((s) => s.openPalette);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const [meMenuAnchorPath, setMeMenuAnchorPath] = useState<string | null>(null);
  const activeAccountNavKey = getActiveAccountNavKey(pathname);
  const isAccountArea = isAccountFamilyPath(pathname);
  const meMenuOpen = meMenuAnchorPath === pathname;
  const progressOverview = useProgressOverview();
  const weeklySummary = useProgressWeeklySummary();
  const setMeMenuOpen = (open: boolean) => {
    setMeMenuAnchorPath(open ? pathname : null);
  };

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
         * a filled 28×28 glyph on a 40×40 viewBox token-themed via currentColor /
         * background. lint-icon-style scans .svg files only, so inline JSX
         * <svg> is exempt by scope (verified 2026-05-26).
         */}
        <svg
          width="28"
          height="28"
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

  const resolvedUser = user ?? (authUser ? {
    displayName: authUser.displayName,
    avatarSrc: undefined,
    subtitle: ME_SUBTITLE_FALLBACK,
    email: authUser.email ?? null,
  } : undefined);
  const meName = resolvedUser?.displayName ?? '我';
  const meSub = resolvedUser?.subtitle ?? ME_SUBTITLE_FALLBACK;
  const meEmail = resolvedUser?.email ?? null;
  const progressAllTime = progressOverview.data?.summary.allTime;
  const meMenuSummary = [
    {
      key: 'questions',
      value:
        progressAllTime !== undefined
          ? INTL_NUMBER.format(progressAllTime.itemsAnswered)
          : '—',
      label: '累计题',
    },
    {
      key: 'accuracy',
      value:
        progressAllTime?.accuracy !== undefined
          ? formatAccuracyPct(progressAllTime.accuracy)
          : '—',
      label: '正确率',
    },
    {
      key: 'streak',
      value:
        typeof weeklySummary.data?.streakDays === 'number'
          ? INTL_NUMBER.format(weeklySummary.data.streakDays)
          : '—',
      label: '连续天',
    },
  ] as const;
  const me: ReactNode = (
    <Popover
      open={meMenuOpen}
      onOpenChange={setMeMenuOpen}
      side="right"
      align="end"
      width={280}
      panelLabel="账户菜单"
      panelClassName={styles.meMenuPanel}
      trigger={(
        <button
          type="button"
          className={styles.meTrigger}
          data-testid="rail-me-trigger"
          data-tip="我的"
          data-active={isAccountArea || undefined}
          aria-label="我的"
          aria-haspopup="dialog"
        >
          <Avatar
            src={resolvedUser?.avatarSrc}
            fallback={getInitials(resolvedUser)}
            alt={resolvedUser?.displayName}
            size="md"
            status="online"
          />
          <span className={styles.meStack}>
            <span className={styles.meName}>{meName}</span>
            <span className={styles.meSub}>{meSub}</span>
          </span>
        </button>
      )}
    >
      <div className={styles.meMenu} data-testid="rail-me-menu">
        <div className={styles.meMenuHead} data-testid="rail-me-menu-head">
          <div className={styles.meMenuAvatar}>
            <Avatar
              src={resolvedUser?.avatarSrc}
              fallback={getInitials(resolvedUser)}
              alt={resolvedUser?.displayName}
              size="lg"
            />
          </div>
          <div className={styles.meMenuIdentity}>
            <div className={styles.meMenuName}>{meName}</div>
            {meEmail !== null ? (
              <div className={styles.meMenuMail}>{meEmail}</div>
            ) : null}
            <div className={styles.meMenuBadge}>{meSub}</div>
          </div>
        </div>
        <div className={styles.meMenuSummary} data-testid="rail-me-menu-summary">
          {meMenuSummary.map((item) => (
            <div key={item.key}>
              <b>{item.value}</b>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <ul className={styles.meMenuList} role="list">
          {ACCOUNT_NAV_ITEMS.map((item) => {
            const isCurrent = activeAccountNavKey === item.key;
            if (!item.enabled) {
              return (
                <li key={item.key}>
                  <span
                    className={styles.meMenuItem}
                    data-active={isCurrent || undefined}
                    data-disabled="true"
                    data-testid={`rail-me-menu-item-${item.key}`}
                    aria-disabled="true"
                  >
                    <span className={styles.meMenuIcon} aria-hidden="true">
                      <SpriteIcon id={ACCOUNT_MENU_ICONS[item.key]} size={14} />
                    </span>
                    <span className={styles.meMenuLabel}>{item.label}</span>
                    <span className={styles.meMenuState}>未开放</span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={styles.meMenuItem}
                  data-active={isCurrent || undefined}
                  data-testid={`rail-me-menu-item-${item.key}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setMeMenuOpen(false)}
                >
                  <span className={styles.meMenuIcon} aria-hidden="true">
                    <SpriteIcon id={ACCOUNT_MENU_ICONS[item.key]} size={14} />
                  </span>
                  <span className={styles.meMenuLabel}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Popover>
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

function formatAccuracyPct(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  const num = Number(raw);
  if (!Number.isFinite(num)) return '—';
  return `${Math.round(num * 100)}%`;
}

export type { RootLayoutProps };
