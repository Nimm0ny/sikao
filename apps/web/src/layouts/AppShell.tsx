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
 * 路由 API: 跟 router/index.tsx 现状一致 — AppShell 用 layout route 形式挂在
 * <Route element={<AppShell />}> + 内部 <Outlet /> 渲染 children. **不**走 plan
 * F 写的 children prop API (那是 Handoff 抄来的样例, 跟实际 router 不符), 各
 * shell 自挂 Outlet 让 router 调用方零改动.
 */
export function AppShell() {
  return (
    <OnboardingGate>
      <MvpShell />
    </OnboardingGate>
  );
}
