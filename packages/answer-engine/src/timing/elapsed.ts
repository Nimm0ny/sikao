// 计时器 — 纯逻辑
//
// R2.3（2026-05-13）：从 apps/web/src/components/practice/fb/useFbSession.ts
// 与 packages/domain/src/shenlun/useEssaySessionElapsed.ts 抽离（ADR-0002）。
//
// 两种计时模型：
//
// 1. **wallclock 模式**（申论）：start 时刻已知，delta = now - startMs
//    - 优点：tab 切到后台 setInterval 节流不丢秒（重算 delta 自动补正）
//    - 用于：申论考场（用户感知"考了多久"应当与挂钟一致）
//
// 2. **tick 累加模式**（行测）：每秒 +1，暂停时停 tick
//    - 优点：暂停后恢复，elapsed 不跳变
//    - 缺点：tab 后台 1 分钟回来可能少几秒（setInterval 节流）
//    - 用于：行测答题（pause-aware 是关键功能，挂钟差异可忽略）
//
// 这里只提供纯计算函数。React useEffect 包装放在 @sikao/domain 或调用方。

/**
 * wallclock 模式：根据起始时间戳计算 elapsed seconds。
 * tab 后台节流不丢秒，每次 tick 重算自动补正。
 */
export function computeElapsedSeconds(startMs: number, nowMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || nowMs < startMs) return 0;
  return Math.floor((nowMs - startMs) / 1000);
}

/**
 * tick 累加模式：调用方在每个 tick 调本函数，传 prev + isPaused → next。
 * 暂停时返回 prev 不变（计时停顿）。
 */
export function nextTickElapsed(prev: number, isPaused: boolean): number {
  if (isPaused) return prev;
  return prev + 1;
}

/**
 * 把秒数格式化为 MM:SS（用于 UI 显示）。
 * 超过 1 小时自动展开 HH:MM:SS。
 */
export function formatElapsed(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const sec = Math.floor(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 剩余秒数（基于总时限 + 已用时）。
 * 用于"距交卷还有 X 分钟"显示。
 */
export function remainingSeconds(totalLimit: number, elapsed: number): number {
  if (!Number.isFinite(totalLimit) || totalLimit <= 0) return 0;
  return Math.max(0, totalLimit - elapsed);
}

/**
 * 行测默认考试时限（基于题数估算）。
 * fenbi 行测约 1-1.2 题/min，套卷 130 题约 120 min。
 * 这里给个保守上界：题数 × 60s（粗 1 题 1 分钟），实际可由 paper.timeLimit 覆盖。
 */
export function defaultXingceExamSeconds(questionCount: number): number {
  if (!Number.isFinite(questionCount) || questionCount <= 0) return 0;
  return questionCount * 60;
}
