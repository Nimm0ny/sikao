import { useEffect, useRef } from 'react';
import { Numeric } from '../../atom/Numeric';
import styles from './TimerDisplay.module.css';

/*
 * TimerDisplay — V5 D.3.31 business component (skeleton).
 *
 * Why: monospaced exam timer (HH:MM:SS) driven by remainingMs prop. The
 *      component is fully controlled — display always reflects the
 *      remainingMs prop. While !paused and remainingMs > 0, an internal
 *      1s setInterval fires onTick(remainingMs - 1000) so callers can
 *      drive their own state forward. Callers re-render with the new
 *      remainingMs and the cycle continues.
 *
 *      Reaching warningThreshold flips palette to --color-state-warn;
 *      hitting zero flips to --color-state-err. Numeric is reused for
 *      tabular-nums + size scaling — TimerDisplay is purely the
 *      orchestration shell.
 *
 *      Resize/timer business logic (pause-after-blur, total-time bar)
 *      lives in the dedicated Exam spec (R1/Q5). This component does not
 *      cap remainingMs or guard against drift.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_SECOND_MS = 1000;

export interface TimerDisplayProps {
  readonly remainingMs: number;
  readonly totalMs?: number;
  readonly warningThreshold?: number;
  readonly paused?: boolean;
  readonly onTick?: (remainingMs: number) => void;
}

type Tone = 'rest' | 'warn' | 'err';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function format(remainingMs: number): string {
  const safeMs = Math.max(0, remainingMs);
  const totalSec = Math.floor(safeMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function classifyTone(remainingMs: number, threshold: number): Tone {
  if (remainingMs <= 0) return 'err';
  if (remainingMs <= threshold) return 'warn';
  return 'rest';
}

export function TimerDisplay({
  remainingMs,
  totalMs,
  warningThreshold = FIVE_MINUTES_MS,
  paused = false,
  onTick,
}: TimerDisplayProps) {
  // Latest values via ref so the interval callback always sees fresh inputs
  // without forcing a re-subscribe each render.
  const remainingRef = useRef(remainingMs);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const current = remainingRef.current;
      if (current <= 0) return;
      const next = Math.max(0, current - ONE_SECOND_MS);
      remainingRef.current = next;
      if (onTickRef.current) onTickRef.current(next);
    }, ONE_SECOND_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const tone = classifyTone(remainingMs, warningThreshold);
  const text = format(remainingMs);

  return (
    <span
      className={styles.root}
      data-tone={tone}
      data-paused={paused || undefined}
      data-total-ms={totalMs}
      data-testid="timer-display"
      role="timer"
      aria-live="off"
      aria-label={`剩余 ${text}`}
    >
      <Numeric value={text} size="h3" />
    </span>
  );
}
