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
 * RailMini — 平板竖屏 64px 图标导航条 (PR7, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3.4
 *   - docs/design/Mobile and Tablet Pack New.html (T4 竖屏 shell)
 *
 * 铁线 (Handoff §3.4 + CLAUDE.md §4 答题按钮 SVG-only 政策):
 *   - icon-only, 不渲染 label (跟 TabBar 区分 — TabBar 有 label, RailMini 没)
 *   - 每个 button 44x44 触点 (a11y)
 *   - 每个 NavLink 必带 aria-label (lint:icon-button 兜底)
 *   - 用现有 components/icons/* (不创新 SVG)
 *
 * 仅在 TabletShell portrait 内挂; landscape 走 DesktopShell 的 Sidebar.
 */

interface RailItem {
  readonly to: string;
  readonly icon: ComponentType<IconProps>;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly match: (pathname: string) => boolean;
}

const RAIL_ITEMS: readonly RailItem[] = [
  {
    to: '/',
    icon: SubjectHomeIcon,
    ariaLabel: '首页',
    testId: 'rail-mini-home',
    match: (pathname) => pathname === '/' || pathname === '/app' || pathname === '/study/today',
  },
  {
    to: '/practice',
    icon: SubjectXingceIcon,
    ariaLabel: '练习中心',
    testId: 'rail-mini-practice',
    match: (pathname) => pathname.startsWith('/practice') || pathname.startsWith('/essay'),
  },
  {
    to: '/review',
    icon: SubjectWrongbookIcon,
    ariaLabel: '复盘',
    testId: 'rail-mini-review',
    match: (pathname) => pathname.startsWith('/review') || pathname.startsWith('/wrong-book'),
  },
  {
    to: '/notes',
    icon: NoteIcon,
    ariaLabel: '笔记',
    testId: 'rail-mini-notes',
    match: (pathname) => pathname.startsWith('/notes'),
  },
  {
    to: '/profile',
    icon: SubjectProfileIcon,
    ariaLabel: '我的',
    testId: 'rail-mini-profile',
    match: (pathname) => pathname.startsWith('/profile') || pathname === '/me',
  },
] as const;

export function RailMini() {
  return (
    <nav
      className="rail-mini"
      aria-label="主导航"
      data-testid="rail-mini"
    >
      {RAIL_ITEMS.map((item) => (
        <RailMiniItem key={item.to} item={item} />
      ))}
    </nav>
  );
}

interface RailMiniItemProps {
  readonly item: RailItem;
}

function RailMiniItem({ item }: RailMiniItemProps) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  return (
    <NavLink
      to={item.to}
      aria-label={item.ariaLabel}
      data-testid={item.testId}
      className={() => cn('rail-mini__item', item.match(pathname) && 'rail-mini__item--active')}
    >
      <Icon size={24} />
    </NavLink>
  );
}
