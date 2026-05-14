import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MOTION_DURATION, VIEW_FADE_VARIANTS } from '@sikao/shared-utils';
import { OfflineBanner } from '@/layouts/OfflineBanner';
import { TabBar } from '@/layouts/TabBar';

/**
 * MobileShell — 手机版 shell (PR7, 2026-05-13).
 *
 * 来源 SSOT:
 *   - docs/design/handoff/Mobile and Tablet · Handoff.md §3.3
 *   - docs/design/Mobile and Tablet Pack New.html (M1-M12 通用 shell)
 *
 * 结构:
 *   - main body (flex 1, overflow auto)
 *   - TabBar 底栏 (4 tab 不可扩, 固定底部)
 *
 * 路由内容仍走 <Outlet />, AppShell device-aware dispatch 时把 'mobile' 档落到本
 * shell. PracticeSession (/practice/sessions/*) 走 immersive 模式 — 隐藏 TabBar
 * 避免跟答题底栏冲突 (跟原 AppShell 逻辑对齐).
 *
 * 不接 children prop — AppShell 用 router Outlet 不是 children, 本 shell 内部
 * 自挂 Outlet 跟现有 router API 一致 (PR plan F 的 children 写法是 Handoff 抄来
 * 的样例, 跟实际 router 不符).
 */
export function MobileShell() {
  const { pathname } = useLocation();
  // Phase 5.7 — PracticeSession 是 immersive 模式（设计稿 04 Mobile Question
  // 屏不含 tabbar）, 隐藏 TabBar 防底栏冲突.
  const inPracticeSession = pathname.startsWith('/practice/sessions/');
  return (
    <div className="mobile-shell" data-shell="mobile">
      <OfflineBanner />
      <main className="mobile-shell__body">
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
      </main>
      {!inPracticeSession ? <TabBar /> : null}
    </div>
  );
}
