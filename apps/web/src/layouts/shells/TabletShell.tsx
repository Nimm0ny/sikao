import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MOTION_DURATION, VIEW_FADE_VARIANTS } from '@sikao/shared-utils';
import { useOrientation } from '@sikao/shared-utils/hooks/useOrientation';
import { OfflineBanner } from '@/layouts/OfflineBanner';
import { RailMini } from '@/layouts/RailMini';
import { AsideBottomBar } from '@/layouts/AsideBottomBar';
import { Aside } from '@/layouts/Aside';
import { DesktopShell } from './DesktopShell';

/**
 * TabletShell — 平板 shell (PR7 + PR11 + PR14, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3.4 + §7
 *   - docs/design/handoff/Shenlun & Tablet Refinements · Handoff.md §3 (PR14) + §4 (PR15)
 *   - docs/design/Mobile and Tablet Pack New.html (T1 横屏 / T4 竖屏)
 *
 * 分支:
 *   - portrait (竖屏 768x1024): RailMini 64px + main + AsideBottomBar (PR15 §A).
 *     AsideBottomBar 内部 isPracticeRoute 自判, 非答题闭环 view 0 渲染.
 *   - landscape (横屏 1024x768): DesktopShell (Sidebar + main + Outlet) + Aside 320w
 *     常驻右侧三栏 (PR11). DesktopShell 已含完整 sidebar + main + offline banner
 *     + outlet 结构, 横屏跟桌面体感一致; Aside 通过 AsideOutletContext (PR15)
 *     跨树读取路由 view 注入的 panel, panel 空 → Aside return null 自动退场.
 *     PR14: Aside 默认 collapsed=true (32px 浮条), click 展开. 跟 Handoff §3.4
 *     T1 默认 collapsed 一致.
 *
 * Rail 共用决策 (PR11): DesktopShell 内部 Sidebar 用 `w-60` (240px), 不抽独立
 * `Rail.tsx`, 直接 reuse DesktopShell 节省维护成本. 跟 Handoff §7.2 example
 * 写的 `Rail width=220` 偏差 20px 可接受 (sidebar 视觉一致比像素严格更重要,
 * 240 仍在 200-260 标准 sidebar 宽度区间).
 */
export function TabletShell() {
  const orientation = useOrientation();
  if (orientation === 'portrait') {
    return <TabletPortrait />;
  }
  return <TabletLandscape />;
}

function TabletLandscape() {
  // landscape: DesktopShell (Sidebar+main+Outlet) + Aside 320 sibling.
  // DesktopShell 外层 `flex min-h-screen` 自带 sticky sidebar + main flex-1 结构,
  // 包一层 flex 让 DesktopShell + Aside 横向并列. Aside 内部 panels 空 → null
  // 自动退场, 非答题路由 Aside 不占视觉空间, view 自然回退到 DesktopShell 单
  // 双栏 (sidebar + main).
  return (
    <div className="tablet-shell-l" data-shell="tablet-landscape">
      <div className="tablet-shell-l__body">
        <DesktopShell />
      </div>
      {/* PR14 §3.4: T1 横屏 Aside 默认 collapsed (32px 浮条), click 展开. */}
      <Aside
        width={320}
        label="解析 / 笔记 / AI"
        defaultCollapsed={true}
      />
    </div>
  );
}

function TabletPortrait() {
  const { pathname } = useLocation();
  return (
    <div className="tablet-shell-p" data-shell="tablet-portrait">
      <RailMini />
      <main className="tablet-shell-p__body">
        <OfflineBanner />
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={VIEW_FADE_VARIANTS.initial}
              animate={VIEW_FADE_VARIANTS.animate}
              exit={VIEW_FADE_VARIANTS.exit}
              transition={{ duration: MOTION_DURATION.base }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* PR15 §4.3: 答题闭环 view portrait 底部 3 IconBtn 切换栏 (解析/笔记/AI).
            AsideBottomBar 内部 isPracticeRoute + panels 缺失 双重 gate, 非答题
            view 自动 return null, 不占视觉空间. */}
        <AsideBottomBar />
      </main>
      {/* Aside slot — PR11 实施 */}
    </div>
  );
}
