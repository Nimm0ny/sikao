import { useEffect, useRef } from 'react';
import { ClockIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';
import { PRACTICE_COPY } from '@/lib/ui-copy';

// 答题计时器 (controlled). 单一 elapsed source 由 smart container (PracticeShell)
// 持有并下发, 保证 header timer 与 drawer footer 倒计时永远同步, 不会因独立
// setInterval / 浏览器 tab throttle 漂移.
//
// 两种模式:
//   - exam:     倒计时 (durationSeconds - elapsedSeconds → 0).
//               <= 5 min 进入临界态 (warn 黄底).
//               归零自动调 onTimeout (Practice 用作自动交卷, ref guard 不重复).
//   - practice: 正计时 (elapsedSeconds 直显). 不警告不归零, onTimeout 永不触发.

const WARN_THRESHOLD_SECONDS = 300;

export type PracticeTimerMode = 'exam' | 'practice';

export interface PracticeTimerProps {
  readonly durationSeconds: number;
  readonly mode: PracticeTimerMode;
  readonly elapsedSeconds: number;
  /** 仅供 data-state / a11y 提示, 不影响 elapsed (caller 决定 elapsed 是否推进). */
  readonly paused?: boolean;
  readonly onTimeout?: () => void;
  readonly className?: string;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function PracticeTimer({
  durationSeconds,
  mode,
  elapsedSeconds,
  paused = false,
  onTimeout,
  className,
}: PracticeTimerProps) {
  const remaining = mode === 'exam' ? Math.max(0, durationSeconds - elapsedSeconds) : 0;
  const display = mode === 'exam' ? formatDuration(remaining) : formatDuration(elapsedSeconds);

  const timeoutFiredRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (mode !== 'exam') return;
    if (remaining > 0) return;
    if (timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    onTimeoutRef.current?.();
  }, [mode, remaining]);

  const isCritical = mode === 'exam' && remaining > 0 && remaining <= WARN_THRESHOLD_SECONDS;
  const isExpired = mode === 'exam' && remaining === 0;

  return (
    <span
      className={cn(
        // 尺寸 (lhr 反馈: 之前 text-sm + py-1 在 footer 里偏小, 跟旁边 h-11
        // IconButton 比例失衡). 现 text-base + px-3 py-2 让倒计时成为视觉锚点.
        'inline-flex items-center gap-2 px-3 py-2 rounded-1 font-mono text-base font-semibold tabular-nums',
        'bg-surface-alt text-ink',
        isCritical && 'bg-warn-bg text-warn',
        isExpired && 'bg-line text-ink-3',
        className,
      )}
      role="timer"
      aria-live={isCritical ? 'assertive' : 'off'}
      aria-label={
        mode === 'exam'
          ? isExpired
            ? PRACTICE_COPY.timerEnded
            : `剩余 ${display}`
          : `已用 ${display}`
      }
      data-testid="practice-timer"
      data-mode={mode}
      data-state={paused ? 'paused' : isExpired ? 'expired' : isCritical ? 'critical' : 'normal'}
    >
      <ClockIcon size={16} className="shrink-0" />
      {isExpired ? '时间到' : display}
    </span>
  );
}
