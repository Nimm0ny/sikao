// SIKAO 国考倒计时 helper (Wave 1 Round 2 抽出共享).
//
// Wave 4 X2 (2026-05-12): BE 接入由 `@/api/examEventsQueries.useNationalExamCountdown`
// 完成 — hook 全集拉 /exam-events + filter category=='national' 升序 first.
// 本文件保留 DEFAULT_* 作为 loading / error / 空集 兜底 (graceful 非 silent —
// hook error 同时 toast.error 通知). 2026-11-29 估测 — 中国公考惯例下 2026 年
// 11 月最后一个周日左右笔试; label "2026 国考" 跟 hifi mock 一致.
// 失效 (days < 0) 时 callers 走兜底文案隐藏倒计时.

export const DEFAULT_EXAM_DATE_ISO = '2026-11-29';
export const DEFAULT_EXAM_LABEL = '2026 国考';

export function daysUntilExam(
  isoDate: string = DEFAULT_EXAM_DATE_ISO,
  now: Date = new Date(),
): number {
  const target = new Date(`${isoDate}T00:00:00`);
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  return Math.round((targetUtc - nowUtc) / (24 * 60 * 60 * 1000));
}
