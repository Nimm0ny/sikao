import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavCloseIcon } from '@sikao/ui/icons';
import { Tooltip } from '@sikao/ui/ui';
import { cn } from '@sikao/shared-utils';
import { MOTION_SPRING_SOFT } from '@sikao/shared-utils';

// Phase 3.2 Wave D fenbi-merge — 底部 65% panel 替换原右侧 Drawer 答题卡用法.
// 对齐 prototype 03 frame 2 .answer-card-panel.
//
// 之前用通用 <Drawer> mobile=底部 / desktop=右侧滑入, 跟 fenbi 视觉差距大.
// Wave D 决策: 答题卡专用底部 panel, mobile 与 PC 行为统一. Drawer 通用组件
// 保留供其他场景, 此处不复用.
//
// 入口: AnswerCardStickyTab (左下贴边). open 由 caller 控制. 关闭走 onClose.
// header / body / footer 都由 caller 注入 (Smart/Dumb 切割).

export interface AnswerCardPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly header: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly closeOnEsc?: boolean;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function AnswerCardPanel({
  open,
  onClose,
  header,
  footer,
  children,
  closeOnEsc = true,
  className,
  ariaLabel = '答题卡',
}: AnswerCardPanelProps) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;
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
            key="acp-scrim"
            type="button"
            aria-label="关闭答题卡"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-30 bg-sidebar/20"
            data-testid="answer-card-panel-scrim"
          />
          <motion.section
            key="acp-panel"
            role="dialog"
            aria-label={ariaLabel}
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={MOTION_SPRING_SOFT}
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 flex flex-col',
              'h-[65vh] max-h-[520px]',
              'bg-surface border-t border-line rounded-t-card-lg shadow-pop',
              className,
            )}
            data-testid="answer-card-panel"
          >
            <PanelHeader onClose={onClose}>{header}</PanelHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 md:px-7">{children}</div>
            {footer !== undefined ? footer : null}
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}

interface PanelHeaderProps {
  readonly onClose: () => void;
  readonly children: ReactNode;
}

function PanelHeader({ onClose, children }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line md:px-7">
      <div className="min-w-0 flex-1">{children}</div>
      <Tooltip label="关闭">
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭答题卡"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-1 text-ink-3',
            'hover:bg-surface-alt hover:text-ink transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
          data-testid="answer-card-panel-close"
        >
          <NavCloseIcon size={16} />
        </button>
      </Tooltip>
    </div>
  );
}
