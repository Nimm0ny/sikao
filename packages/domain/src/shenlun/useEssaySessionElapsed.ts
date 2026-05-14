/**
 * PR13 P5 FE · 申论 session 计时 hook（wallclock 模式）。
 *
 * 返回 hook mount 以来的 elapsed seconds。1s tick via setInterval，
 * useRef 持 startMs，re-render 不重置计数。
 *
 * R2.3 (2026-05-13)：纯 elapsed 计算抽到 @sikao/answer-engine/timing（ADR-0002），
 * 这里只剩 React hook 包装。
 *
 * 用法（ShenlunSession shell）：
 *   const elapsedSeconds = useEssaySessionElapsed();
 *   <TopBar elapsedSeconds={elapsedSeconds} ... />
 *
 * SSR-safe：parent ShenlunSession render-throws on SSR（useInputMode 内 throw），
 * 这里不再二次 guard window —— 走 import-time browser-only 约定。
 */
import { useEffect, useRef, useState } from 'react';
import { computeElapsedSeconds } from '@sikao/answer-engine/timing';

export function useEssaySessionElapsed(): number {
  // startMs 走 ref + effect 初始化（React 19 lint react-hooks/purity 禁
  // render 期 Date.now()）。重新 mount 时，hook 重新从 0 开始 —— 这是预期行为，
  // ShenlunSession unmount = 用户退出当前题。测试用 vi.useFakeTimers 控。
  const startMsRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    // effect 内初始化 startMs（pure render body 不允许 Date.now）。同一 mount
    // 周期内只设一次，重 mount 走新值；不写 ref-from-render warning。
    startMsRef.current = Date.now();
    // tick 1s；delta 走 startMs 不走 prev + 1，避免漂移（tab 后台时
    // setInterval 节流会 skip tick，computeElapsedSeconds 自动补正）。
    const id = window.setInterval(() => {
      if (startMsRef.current === null) return;
      setElapsedSeconds(computeElapsedSeconds(startMsRef.current, Date.now()));
    }, 1000);
    return () => {
      window.clearInterval(id);
      startMsRef.current = null;
    };
  }, []);

  return elapsedSeconds;
}
