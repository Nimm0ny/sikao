import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LogoutIcon,
  SubjectDashboardIcon,
  SubjectHomeIcon,
  SubjectPlanIcon,
  SubjectProfileIcon,
  SubjectWrongbookIcon,
  type IconProps,
} from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';

/**
 * MobileTabBar — 移动端底部 4 项 tab 栏（Phase 5.7）。
 *
 * 设计参考：element/ui_kits/mobile/index.html §42-55 (.tabbar)。固定底部，
 * `md:hidden` 在 desktop 隐藏。前 3 项 NavLink 路由切换；"我的" 是 sheet trigger
 * 而非独立路由 —— 复用 AppShell sidebar 的 Identity 功能（username + 退出登录），
 * mobile 没必要单独建一个 /profile 页。
 *
 * 交互：tap "我的" → 半屏 bottom-sheet（slide up + backdrop）。tap backdrop /
 * 退出登录 / Esc 都关掉。Sheet 不脱离 React tree（不用 portal）—— mobile 单一
 * stacking context 够用。
 *
 * Tab 设计（决策固化于 docs/ui-rollout/phase5-rebrand.md §Phase 5.7）：
 *   首页 (/app) ／ 错题 (/wrong-book) ／ 数据 (/dashboard) ／ 我的 (sheet)
 */

type TabSlug = 'home' | 'wrong-book' | 'dashboard';

interface TabEntry {
  readonly slug: TabSlug;
  readonly label: string;
  readonly icon: ComponentType<IconProps>;
  readonly to: string;
  readonly testId: string;
  readonly match: (pathname: string) => boolean;
}

const TAB_ENTRIES: readonly TabEntry[] = [
  {
    slug: 'home',
    label: '首页',
    icon: SubjectHomeIcon,
    to: '/app',
    testId: 'mobile-tab-home',
    match: (p) => p === '/app' || p === '/',
  },
  {
    slug: 'wrong-book',
    label: '错题',
    icon: SubjectWrongbookIcon,
    to: '/wrong-book',
    testId: 'mobile-tab-wrong-book',
    match: (p) => p.startsWith('/wrong-book'),
  },
  {
    slug: 'dashboard',
    label: '学情',
    icon: SubjectDashboardIcon,
    to: '/dashboard',
    testId: 'mobile-tab-dashboard',
    match: (p) => p.startsWith('/dashboard'),
  },
];

export function MobileTabBar() {
  const { pathname } = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const profileActive = sheetOpen;

  return (
    <>
      <nav
        className={cn(
          'md:hidden fixed bottom-0 inset-x-0 z-30',
          'h-tabbar pb-safe',
          'grid grid-cols-4',
          'bg-surface/95 backdrop-blur border-t border-line',
        )}
        aria-label="移动端底部导航"
        data-testid="mobile-tabbar"
      >
        {TAB_ENTRIES.map((entry) => (
          <TabLink key={entry.slug} entry={entry} active={entry.match(pathname)} />
        ))}
        <ProfileTabButton
          active={profileActive}
          onClick={() => setSheetOpen(true)}
        />
      </nav>
      {sheetOpen ? <ProfileSheet onClose={() => setSheetOpen(false)} /> : null}
    </>
  );
}

interface TabLinkProps {
  readonly entry: TabEntry;
  readonly active: boolean;
}

function TabLink({ entry, active }: TabLinkProps) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-tiny font-medium',
        'transition-colors duration-fast',
        active ? 'text-ink' : 'text-ink-3',
      )}
      data-testid={entry.testId}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      <span>{entry.label}</span>
    </NavLink>
  );
}

interface ProfileTabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
}

function ProfileTabButton({ active, onClick }: ProfileTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-tiny font-medium',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-50',
        active ? 'text-ink' : 'text-ink-3',
      )}
      aria-haspopup="dialog"
      aria-expanded={active}
      data-testid="mobile-tab-profile"
    >
      <SubjectProfileIcon size={20} className="w-5 h-5" />
      <span>我的</span>
    </button>
  );
}

interface ProfileSheetProps {
  readonly onClose: () => void;
}

function ProfileSheet({ onClose }: ProfileSheetProps) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = user?.displayName ?? user?.username ?? '未登录';
  const username = user?.username ?? '匿名';
  const avatarChar = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    clearSession();
    onClose();
    navigate('/', { replace: true });
  };

  return (
    <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-label="账户面板">
      <button
        type="button"
        aria-label="关闭面板"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
        data-testid="mobile-profile-backdrop"
      />
      <div
        className="absolute bottom-0 inset-x-0 bg-surface border-t border-line rounded-t-card-lg pb-safe"
        data-testid="mobile-profile-sheet"
      >
        <div className="flex items-center justify-center pt-3 pb-1">
          <span aria-hidden="true" className="block w-9 h-[3px] rounded-pill bg-line-3" />
        </div>
        <div className="px-5 pb-4 pt-2 flex items-center gap-3 border-b border-line">
          <div
            className="w-10 h-10 rounded-pill bg-ink text-white font-bold flex items-center justify-center text-sm"
            aria-hidden="true"
          >
            {avatarChar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink font-semibold truncate">{displayName}</div>
            <div className="text-xs text-ink-3 truncate">{username}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/calendar');
          }}
          className="w-full px-5 py-4 flex items-center gap-3 text-sm text-ink hover:bg-surface-alt transition-colors border-b border-line"
          data-testid="mobile-calendar-link"
        >
          <SubjectPlanIcon size={16} className="w-4 h-4" />
          <span>考试日历</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-5 py-4 flex items-center gap-3 text-sm text-ink hover:bg-surface-alt transition-colors"
          data-testid="mobile-logout-btn"
        >
          <LogoutIcon size={16} className="w-4 h-4" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
}
