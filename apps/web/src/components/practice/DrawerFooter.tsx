import { Button } from '@sikao/ui/ui';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// 答题卡抽屉底部栏. 对齐 Figma node 11:3 中 "Drawer Footer" (620x64).
//
// 左: 未答统计 + 计时 (label 由 caller 决定 — exam 用"剩余", practice 用"当前用时")
// 右: "返回当前题" secondary + "交卷" danger
//
// Dumb component — label/value 都由 smart container 注入, 保证 label 与 value
// 语义匹配 (避免 "当前用时 1:54:32 在递减" 这类自相矛盾).

export interface DrawerFooterProps {
  readonly unansweredCount: number;
  readonly timerLabel: string;
  readonly timerDisplay: string;
  readonly onBackToCurrent: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting?: boolean;
}

export function DrawerFooter({
  unansweredCount,
  timerLabel,
  timerDisplay,
  onBackToCurrent,
  onSubmit,
  isSubmitting = false,
}: DrawerFooterProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-3 border-t border-line bg-surface-alt md:px-7"
      data-testid="drawer-footer"
    >
      <span className="text-xs text-ink-3">
        未答{' '}
        <b className="text-ink tabular-nums font-semibold">{unansweredCount}</b>{' '}
        题 · {timerLabel}{' '}
        <b className="text-ink tabular-nums font-mono">{timerDisplay}</b>
      </span>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBackToCurrent}
          data-testid="drawer-footer-back"
        >
          {PRACTICE_COPY.drawerBackToCurrent}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          data-testid="drawer-footer-submit"
        >
          交卷
        </Button>
      </div>
    </div>
  );
}
