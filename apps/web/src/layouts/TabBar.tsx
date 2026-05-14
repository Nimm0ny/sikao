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
 * TabBar — mobile 底栏 (PR7, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3.3
 *   - docs/design/Mobile and Tablet Pack New.html (M1-M12 通用 shell)
 *
 * 铁线 (lhr 2026-05-12 拍板):
 *   - 4 tab 不可扩, 超过 4 = 砍
 *   - 顺序固定: 首页 / 练习 / 错题 / 我的
 *   - 11px Source Serif 4 + ink-4 default + ink-1 active
 *   - 路由对齐 PR16: /practice/center (练习中心整合入口); PR7 ship 时该路由
 *     可能未落, 现有点击会落到 NotFound — 跟 PR16 plan 配对.
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
}

const TABS: readonly TabEntry[] = [
  {
    to: '/app',
    icon: SubjectHomeIcon,
    label: '首页',
    ariaLabel: '首页',
    testId: 'tabbar-home',
  },
  {
    // PR16 练习中心路由; PR7 ship 时尚未落, 点击落 NotFound — 跟 PR16 配对.
    to: '/practice/center',
    icon: SubjectXingceIcon,
    label: '练习',
    ariaLabel: '练习中心',
    testId: 'tabbar-practice',
  },
  {
    to: '/wrong-book',
    icon: SubjectWrongbookIcon,
    label: '错题',
    ariaLabel: '错题本',
    testId: 'tabbar-wrong-book',
  },
  {
    to: '/me',
    icon: SubjectProfileIcon,
    label: '我的',
    ariaLabel: '我的',
    testId: 'tabbar-me',
  },
] as const;
// 不可扩 · 超过 4 个 = 砍 (Handoff §3.3 铁线)

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
  return (
    <NavLink
      to={tab.to}
      end
      aria-label={tab.ariaLabel}
      data-testid={tab.testId}
      className={({ isActive }) =>
        cn('tab-item', isActive && 'tab-item--active')
      }
    >
      <Icon size={22} />
      <span>{tab.label}</span>
    </NavLink>
  );
}
