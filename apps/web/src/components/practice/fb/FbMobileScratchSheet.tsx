import { AnimatePresence, motion } from 'framer-motion';
import { IconBtn, Tooltip } from '@sikao/ui/ui';
import { XCloseIcon } from '@sikao/ui/icons';
import { usePracticeStore } from '@sikao/domain/answer-session/usePracticeStore';
import { FbScratchCol } from './FbScratchCol';

// SIKAO Phase 3 (2026-05-09): mobile 端 scratch sheet.
//
// 抽自 PracticeSession.tsx (单文件 ≤500 行硬约束).
//
// Phase 3 mobile 由 FAB 打开 bottom sheet, 使用 y-axis 入场并覆盖当前答题视图.

export interface FbMobileScratchSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly clips: ReturnType<typeof usePracticeStore.getState>['scratchClips'];
  readonly currentQuestionLabel: string | null;
  readonly currentQuestionId: string | null;
  readonly onAddClip: ReturnType<typeof usePracticeStore.getState>['addScratchClip'];
  readonly onRemoveClip: ReturnType<typeof usePracticeStore.getState>['removeScratchClip'];
}

export function FbMobileScratchSheet({
  open,
  onClose,
  clips,
  currentQuestionLabel,
  currentQuestionId,
  onAddClip,
  onRemoveClip,
}: FbMobileScratchSheetProps) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <>
          <motion.button
            key="fb-mobile-scratch-scrim"
            type="button"
            aria-label="关闭便签"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-40 bg-sidebar/30 md:hidden"
            data-testid="fb-mobile-scratch-scrim"
          />
          <motion.aside
            key="fb-mobile-scratch-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="便签草稿"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fb-bottom-sheet fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-card-lg bg-surface border-t border-line shadow-pop md:hidden"
            data-testid="fb-mobile-scratch-sheet"
          >
            <div className="flex items-center justify-between gap-4 h-14 px-5 border-b border-line">
              <h2 className="font-serif text-base font-medium text-ink">便签草稿</h2>
              <Tooltip label="关闭便签" side="left">
                <IconBtn
                  size="sm"
                  aria-label="关闭便签"
                  onClick={onClose}
                  data-testid="fb-mobile-scratch-close"
                >
                  <XCloseIcon size={16} />
                </IconBtn>
              </Tooltip>
            </div>
            <div className="px-5 py-4">
              <FbScratchCol
                clips={clips}
                answeredCount={5}
                currentQuestionLabel={currentQuestionLabel}
                currentQuestionId={currentQuestionId}
                onAddClip={onAddClip}
                onRemoveClip={onRemoveClip}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
