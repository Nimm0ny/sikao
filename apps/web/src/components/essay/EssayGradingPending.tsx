import { useEffect, useState } from 'react';
import { LoaderIcon } from '@sikao/ui/icons';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';

// Slice 2d — pending 评分态 (dumb except for elapsed-time tick).
//
// 30 秒后还没好显示 slowHint (不 abort, 不 retry). 常规请求多在数秒内完成,
// 个别长篇可能更久. 30s 是 generous 阈值 (R11 grace period 是 5min). 上层
// view 通过 useQuery refetchInterval=1s 真轮询, 本组件只展示 + 过 30s 给
// fallback 文案.

const SLOW_HINT_THRESHOLD_SEC = 30;

export interface EssayGradingPendingProps {
  // ms timestamp. 上层传 record.createdAt parse 后的 Date.now() 起点.
  readonly startedAt: number;
  readonly className?: string;
}

export function EssayGradingPending({
  startedAt,
  className,
}: EssayGradingPendingProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const isSlow = elapsedSec >= SLOW_HINT_THRESHOLD_SEC;

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center py-12',
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid="essay-grading-pending"
    >
      <LoaderIcon
        className="w-8 h-8 text-ink animate-spin mb-4"
      />
      <h3 className="text-md font-medium text-ink mb-2">
        {ESSAY_GRADING_COPY.pendingTitle}
      </h3>
      <p className="text-sm text-ink-3">
        {ESSAY_GRADING_COPY.pendingDesc}
      </p>
      {isSlow ? (
        <p
          className="mt-4 text-sm text-ink-3 max-w-md"
          data-testid="essay-grading-pending-slow-hint"
        >
          {ESSAY_GRADING_COPY.pendingSlowHint}
        </p>
      ) : null}
      <span
        className="mt-3 text-tiny font-mono tracking-loose text-ink-4"
        data-testid="essay-grading-pending-elapsed"
      >
        {elapsedSec}s
      </span>
    </div>
  );
}
