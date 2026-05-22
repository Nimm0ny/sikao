import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@sikao/shared-utils';
import {
  NoteIcon,
  SubjectHomeIcon,
  SubjectXingceIcon,
  SubjectWrongbookIcon,
  SubjectProfileIcon,
  type IconProps,
} from '@sikao/ui/icons';
import type { ComponentType } from 'react';

/**
 * TabBar — mobile 底栏 (PR7, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3.3
 *   - docs/design/Mobile and Tablet Pack New.html (M1-M12 通用 shell)
 *
 * 铁线 (Home M11 收口后):
 *   - 5 tab 固定: 首页 / 练习 / 复盘 / 笔记 / 我的
 *   - 11px Source Serif 4 + ink-4 default + ink-1 active
 *   - 路由对齐 Home canonical: / /practice /review /notes /profile
 *   - icon SVG-only, 用现有 components/icons/* (不创新 SVG)
 *   - 每个 NavLink 必带 aria-label (lint:icon-button 兜底)
 *
 * 不渲染 device dispatch — 仅在 MobileShell 内挂; AppShell 已切走桌面.
 */

interface TabEntry {
  readonly to: string;
  readonly icon: ComponentType<IconProps>;
  readonly label: string;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly match: (pathname: string) => boolean;
}

const TABS: readonly TabEntry[] = [
  {
    to: '/',
    icon: SubjectHomeIcon,
    label: '首页',
    ariaLabel: '首页',
    testId: 'tabbar-home',
    match: (pathname) => pathname === '/' || pathname === '/app' || pathname === '/study/today',
  },
  {
    to: '/practice',
    icon: SubjectXingceIcon,
    label: '练习',
    ariaLabel: '练习中心',
    testId: 'tabbar-practice',
    match: (pathname) => pathname.startsWith('/practice') || pathname.startsWith('/essay'),
  },
  {
    to: '/review',
    icon: SubjectWrongbookIcon,
    label: '复盘',
    ariaLabel: '复盘',
    testId: 'tabbar-review',
    match: (pathname) => pathname.startsWith('/review') || pathname.startsWith('/wrong-book'),
  },
  {
    to: '/notes',
    icon: NoteIcon,
    label: '笔记',
    ariaLabel: '笔记',
    testId: 'tabbar-notes',
    match: (pathname) => pathname.startsWith('/notes'),
  },
  {
    to: '/profile',
    icon: SubjectProfileIcon,
    label: '我的',
    ariaLabel: '我的',
    testId: 'tabbar-profile',
    match: (pathname) => pathname.startsWith('/profile') || pathname === '/me',
  },
] as const;

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="主导航" data-testid="mobile-tabbar">
      {TABS.map((tab) => (
        <TabItem key={tab.to} tab={tab} />
      ))}
    </nav>
  );
}

interface TabItemProps {
  readonly tab: TabEntry;
}

function TabItem({ tab }: TabItemProps) {
  const Icon = tab.icon;
  const { pathname } = useLocation();
  return (
    <NavLink
      to={tab.to}
      aria-label={tab.ariaLabel}
      data-testid={tab.testId}
      className={() => cn('tab-item', tab.match(pathname) && 'tab-item--active')}
    >
      <Icon size={22} />
      <span>{tab.label}</span>
    </NavLink>
  );
}
