import { ClockIcon } from '@sikao/ui/icons';

interface Props {
  remainingSec: number;
}

// WarnToast — F6.4. One-shot 5min toast slid down from the top edge.
// Lifetime is owned by the caller (ExamShell mounts/unmounts it after a
// 4s timer).

export function WarnToast({ remainingSec }: Props) {
  return (
    <div
      className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-3 bg-ink text-surface rounded-card-lg shadow-pop text-sm font-semibold flex items-center gap-3 exam-slide-down"
      data-testid="exam-warn-toast"
      role="status"
      aria-live="polite"
    >
      <ClockIcon className="w-4 h-4" />
      剩余 {Math.ceil(remainingSec / 60)} 分钟 · 请把握收尾节奏
    </div>
  );
}
