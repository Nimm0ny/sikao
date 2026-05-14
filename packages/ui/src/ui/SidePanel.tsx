import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavCloseIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import { MODAL_BACKDROP_VARIANTS, MOTION_SPRING_SOFT } from '@sikao/shared-utils';

// 右侧滑入面板 (design/session/session-d.jsx 形态: 桌面 720px, 移动全宽).
// 用途: Result 页答题卡 / 任意"上下文工具栏"扩展.
//
// 与 Drawer.tsx 的关系: 不同形态, 拆成两个 dumb 组件 (SRP).
//   - Drawer: 答题中底部上拉, handle pill 常驻, body 在 handle 上方展开
//   - SidePanel: modal-like 右侧覆盖, 关闭后完全 unmount, backdrop 遮罩
//
// 不复用 Drawer 加 side prop (会触发 §4 SRP 反例: 一个组件含布尔 flag
// 切换两种完全不同的行为路径).

export interface SidePanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly closeOnEsc?: boolean;
  /**
   * Optional 屏幕阅读器更详细描述 (escape hatch). 不传时默认走 aria-labelledby
   * 指向可见 h2, 单源 from `title`. 传时切到 aria-label (覆盖 labelledby) —
   * 适合 "答题卡" 这种 visible title 简洁但 SR 需要更详细 ("答题卡 · 点击题号跳转").
   *
   * P1-6 fix (a11y review 2026-04-30): 旧版 aria-label={ariaLabel ?? title} 始终
   * 用 aria-label, 让 title 字符串和 ariaLabel 字符串变成双数据源. 默认改 labelledby
   * 后, title 变成单源.
   */
  readonly ariaLabel?: string;
}

export function SidePanel({
  open,
  onClose,
  title,
  children,
  closeOnEsc = true,
  ariaLabel,
}: SidePanelProps) {
  const headingId = useId();
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  // 默认 aria-labelledby (单源 from h2 visible). ariaLabel 给定时切 aria-label
  // (escape hatch for SR-richer text 如 Result.tsx "答题卡 · 点击题号跳转").
  const labelProps = ariaLabel
    ? { 'aria-label': ariaLabel }
    : { 'aria-labelledby': headingId };

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* backdrop — click 任一处关闭 (与 Esc 等价) */}
          <motion.div
            key="side-backdrop"
            initial={MODAL_BACKDROP_VARIANTS.initial}
            animate={MODAL_BACKDROP_VARIANTS.animate}
            exit={MODAL_BACKDROP_VARIANTS.exit}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* panel — 右侧 slide-in, 全高 */}
          <motion.aside
            key="side-panel"
            role="dialog"
            {...labelProps}
            aria-modal="true"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={MOTION_SPRING_SOFT}
            className={cn(
              'fixed inset-y-0 right-0 z-50 w-full md:w-[720px]',
              'bg-surface border-l border-line shadow-pop',
              'flex flex-col',
            )}
          >
            <header className="flex items-center justify-between px-7 py-5 border-b border-line shrink-0">
              <h2 id={headingId} className="text-h-card font-bold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="text-ink-3 hover:text-ink transition-colors"
                data-testid="side-panel-close"
              >
                {/* SIKAO Phase 2: lucide <X /> → NavCloseIcon (SSOT 1.4 stroke + currentColor). */}
                <NavCloseIcon size={20} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
