import { isAxiosError } from 'axios';

// 共享 fail-fast retry policy. main.tsx default + 各 hook explicit 都用.
//
// - 4xx 全不 retry: 业务错误 (404 not found / 401 auth / 422 validation /
//   400 bad request) retry 也不会变, 浪费用户等待 + BE QPS.
// - 5xx + network 错 retry 2 次: 暂态故障, retry 可能恢复.
//
// 之前 studyPlanQueries.ts inline shouldRetry 只 401/404 fail-fast, 漏 422
// (Phase F round 1 P2 抓的 invalid sessionId 5s lag 根因 — useStudyPlanDetail
// 拿到 invalid id 走 422 retry 2 次 → ~5s 才 fail). 现统一共享 + 收严: 全
// 4xx fail-fast (frontend/CLAUDE.md §3.1 fail-fast 调性对齐).
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      return false;
    }
  }
  return failureCount < 2;
}
