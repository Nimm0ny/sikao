import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@sikao/shared-utils';
import { Button, IconBtn, Tooltip } from '@sikao/ui/ui';
import { NavSubmitIcon, XCloseIcon } from '@sikao/ui/icons';
import { MOTION_SPRING_SOFT } from '@sikao/shared-utils';

// SIKAO Phase 3 (2026-05-09) → Wave 4 Phase 2A (2026-05-12) 改名:
// answer-card right sheet drawer (原 FbDock 命名).
//
// Design SSOT: docs/plan/sikao-xingce-phase3-core.md /
// docs/plan/sikao-module-sikao-redesign-2026-05-11.md (Wave 4).
//
// 改名理由: Wave 4 新增 FbBottomDock (sticky 底栏 nav), 跟原 right-sheet
// 区分; right-sheet 语义更接近 "drawer" (滑入抽屉). 保留 `FbDock` alias
// 防其他文件 breaking (export { FbDrawer as FbDock } 在 index.ts).
//
// 状态:
//   - open: 由 caller 控制 (showDrawer state in PracticeSession)
//   - children: 35 题号网格 + 章节分组 (caller 注入, drawer 自身仅 chrome)
//   - footer: 提交主 CTA + 未答统计 (caller 注入)
//
// Close paths: close button, scrim click, and Esc.
//
// Dumb by contract: 不读 store; 全部内容由 caller.

export interface FbDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly closeOnEsc?: boolean;
}

export function FbDrawer({
  open,
  onClose,
  title = '答题卡',
  children,
  footer,
  closeOnEsc = true,
}: FbDrawerProps) {
  useEffect(() => {
    if (!open || !closeOnEsc) return undefined;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <>
          <motion.button
            key="fb-dock-scrim"
            type="button"
            aria-label="关闭答题卡"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-40 bg-sidebar/30"
            data-testid="fb-dock-scrim"
          />
          <motion.aside
            key="fb-dock-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={MOTION_SPRING_SOFT}
            className={cn(
              'fb-dock fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-80 max-w-sm',
              'bg-surface border-l border-line shadow-pop',
            )}
            data-testid="fb-dock-panel"
          >
            <FbDrawerHeader title={title} onClose={onClose} />
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
            {footer !== undefined ? footer : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

interface FbDrawerHeaderProps {
  readonly title: string;
  readonly onClose: () => void;
}

function FbDrawerHeader({ title, onClose }: FbDrawerHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 h-14 px-5 border-b border-line">
      <h2 className="font-serif text-base font-medium text-ink">{title}</h2>
      <Tooltip label="关闭" side="left">
        <IconBtn
          size="sm"
          aria-label="关闭答题卡"
          onClick={onClose}
          data-testid="fb-dock-close"
        >
          <XCloseIcon size={16} />
        </IconBtn>
      </Tooltip>
    </div>
  );
}

// FbDrawerGrid — 35 题号网格的 grid container (caller 用 NumberCircle / AnswerCell
// Caller renders grid cells through the current answer-cell primitive.
export interface FbDrawerGridProps {
  readonly children: ReactNode;
  readonly cols?: 5 | 6 | 7;
}

export function FbDrawerGrid({ children, cols = 7 }: FbDrawerGridProps) {
  const colClass =
    cols === 5
      ? 'grid-cols-5'
      : cols === 6
        ? 'grid-cols-6'
        : 'grid-cols-7';
  return (
    <div className={cn('grid gap-2', colClass)} data-testid="fb-dock-grid">
      {children}
    </div>
  );
}

// FbDrawerSubmitFooter keeps the answer-card submit row aligned with the current design.
export interface FbDrawerSubmitFooterProps {
  readonly unansweredCount: number;
  readonly markedCount: number;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
}

export function FbDrawerSubmitFooter({
  unansweredCount,
  markedCount,
  onSubmit,
  isSubmitting,
}: FbDrawerSubmitFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-5 py-3 border-t border-line bg-surface',
      )}
      data-testid="fb-dock-footer"
    >
      <p className="flex-1 font-sans text-sm leading-relaxed text-ink-3">
        还有{' '}
        <em className="not-italic font-mono text-ink-3 font-medium tabular-nums">
          {unansweredCount} 题
        </em>{' '}
        未作答 · 已标记{' '}
        <em className="not-italic font-mono text-ink-3 font-medium tabular-nums">
          {markedCount} 题
        </em>
      </p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        leftIcon={<NavSubmitIcon size={16} />}
        onClick={onSubmit}
        isLoading={isSubmitting}
        aria-label="提交答题"
        data-testid="fb-dock-submit"
      >
        提交
      </Button>
    </div>
  );
}
