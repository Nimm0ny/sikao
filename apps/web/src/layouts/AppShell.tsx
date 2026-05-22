import type { ReactNode } from 'react';

import { OnboardingGate } from '@/router/OnboardingGate';
import { MvpShell } from '@/components/mvp';

/**
 * AppShell — device-aware dispatcher (PR7, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/plan/practice-center-mobile-tablet-redesign.md §4 PR7 / PR15
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3 / §7.3
 *
 * 历史: 原 AppShell 单一桌面 shell (sidebar + main + MobileTabBar md:hidden 兜底)
 * 由 PR7 拆 3 shell, AppShell 收敛到 device dispatch 单一职责.
 * PR15 (2026-05-13) 顶层挂 AsideOutletProvider, 让答题闭环 view 通过 useAsideSet
 * 注入"解析 / 笔记 / AI"3 panel, TabletShell portrait 的 AsideBottomBar + landscape
 * 的 Aside (PR11) 跨树读取.
 *
 * 分发契约 (跟 useDevice / useOrientation hook 对齐):
 *   - mobile   (< 1024): MobileShell    + TabBar (4 tab 不可扩)
 *   - tablet   (1024 - 1279): TabletShell
 *       - portrait : RailMini 64px + main + AsideBottomBar (PR15 §A)
 *       - landscape: 复用 DesktopShell (Rail 220 + Aside slot 给 PR11)
 *   - desktop  (>= 1280): DesktopShell  (原 Sidebar + main 不变)
 *
 * 路由 API:
 *   - layout route: <Route element={<AppShell />}> + 内部 Outlet
 *   - root host:    <AppShell><Dashboard /></AppShell>
 * 当前 Home M11 需要让 "/" 已登录态直接挂首页宿主，因此补充 children 直挂模式。
 */
export function AppShell({ children }: { readonly children?: ReactNode }) {
  return (
    <OnboardingGate>
      <MvpShell>{children}</MvpShell>
    </OnboardingGate>
  );
}
