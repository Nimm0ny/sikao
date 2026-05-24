import { useEffect, useRef } from 'react';

export interface HeartbeatLoopOptions {
  readonly enabled: boolean;
  readonly intervalMs?: number;
  readonly onHeartbeat: () => Promise<void> | void;
  readonly onVisible?: () => Promise<void> | void;
  readonly onError?: (error: unknown) => void;
}

export function useHeartbeatLoop({
  enabled,
  intervalMs = 30_000,
  onHeartbeat,
  onVisible,
  onError,
}: HeartbeatLoopOptions) {
  const heartbeatRef = useRef(onHeartbeat);
  const visibleRef = useRef(onVisible);
  const errorRef = useRef(onError);

  useEffect(() => {
    heartbeatRef.current = onHeartbeat;
  }, [onHeartbeat]);

  useEffect(() => {
    visibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled) return;

    const runSafely = (callback: (() => Promise<void> | void) | undefined) => {
      if (!callback) {
        return;
      }
      void Promise.resolve()
        .then(() => callback())
        .catch((error: unknown) => {
          errorRef.current?.(error);
        });
    };

    const runHeartbeat = () => {
      runSafely(heartbeatRef.current);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runSafely(visibleRef.current);
        runHeartbeat();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        runHeartbeat();
      }
    }, intervalMs);

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, intervalMs]);
}
