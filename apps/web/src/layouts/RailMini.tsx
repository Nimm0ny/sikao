import { NavLink } from 'react-router-dom';
import { cn } from '@sikao/shared-utils';
import {
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
}

const RAIL_ITEMS: readonly RailItem[] = [
  {
    to: '/app',
    icon: SubjectHomeIcon,
    ariaLabel: '首页',
    testId: 'rail-mini-home',
  },
  {
    to: '/practice/center',
    icon: SubjectXingceIcon,
    ariaLabel: '练习中心',
    testId: 'rail-mini-practice',
  },
  {
    to: '/wrong-book',
    icon: SubjectWrongbookIcon,
    ariaLabel: '错题本',
    testId: 'rail-mini-wrong-book',
  },
  {
    to: '/me',
    icon: SubjectProfileIcon,
    ariaLabel: '我的',
    testId: 'rail-mini-me',
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
  return (
    <NavLink
      to={item.to}
      end
      aria-label={item.ariaLabel}
      data-testid={item.testId}
      className={({ isActive }) =>
        cn('rail-mini__item', isActive && 'rail-mini__item--active')
      }
    >
      <Icon size={24} />
    </NavLink>
  );
}
