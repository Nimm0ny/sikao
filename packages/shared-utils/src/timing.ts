// Per-question timing — derive each question's elapsed time from the
// monotonic stream of `answered_at` timestamps + the session start.
//
// Why this lives in lib/, not in a backend aggregation:
// 1. Backend already ships `answered_at` per answer; computing diffs
//    in the browser is O(n) and avoids a schema-additive endpoint
//    for v0.2 slice 2 (per docs/plan/result-deep-analysis.md §3).
// 2. The "paused" rule (>10 min cap → treat as user stepped away) is
//    a UX/display decision that may change without a redeploy. Backend
//    keeps raw timestamps; frontend interprets.
//
// Edge cases the tests pin down:
//   - empty answers → []
//   - first answer uses session.startedAt as its baseline
//   - elapsed > PAUSE_THRESHOLD_SEC → paused=true, elapsedSec=0
//   - elapsed < 0 (clock skew / out-of-order) → paused=false, elapsedSec=0
//   - non-monotonic answered_at order: still computed pairwise as given
//     (caller responsibility to sort first; service layer already does).

export const PAUSE_THRESHOLD_SEC = 10 * 60;

export interface AnswerTimingInput {
  readonly questionId: string | number;
  readonly questionNo: number;
  readonly answeredAt: string;
}

export interface QuestionTiming {
  readonly questionId: string;
  readonly questionNo: number;
  /** Seconds spent on this question. Capped to 0 when `paused` is true. */
  readonly elapsedSec: number;
  /** True when the raw delta exceeds PAUSE_THRESHOLD_SEC; UI should hint "暂停". */
  readonly paused: boolean;
}

export function deriveQuestionTimings(
  answers: readonly AnswerTimingInput[],
  sessionStartedAt: string,
): readonly QuestionTiming[] {
  if (answers.length === 0) return [];
  const sessionStartMs = Date.parse(sessionStartedAt);
  if (!Number.isFinite(sessionStartMs)) {
    // Fail-fast: a session without a parseable start is a contract
    // violation. Throw so the caller surfaces it instead of silently
    // returning bogus elapsed values.
    throw new Error(`invalid sessionStartedAt: ${sessionStartedAt}`);
  }
  const out: QuestionTiming[] = [];
  let prevMs = sessionStartMs;
  for (const ans of answers) {
    const curMs = Date.parse(ans.answeredAt);
    if (!Number.isFinite(curMs)) {
      throw new Error(`invalid answeredAt for question ${ans.questionId}: ${ans.answeredAt}`);
    }
    const deltaSec = Math.round((curMs - prevMs) / 1000);
    const paused = deltaSec > PAUSE_THRESHOLD_SEC;
    const elapsedSec = paused || deltaSec < 0 ? 0 : deltaSec;
    out.push({
      questionId: String(ans.questionId),
      questionNo: ans.questionNo,
      elapsedSec,
      paused,
    });
    prevMs = curMs;
  }
  return out;
}

/** Top N slowest questions, sorted by elapsedSec desc. Excludes paused items. */
export function pickSlowestQuestions(
  timings: readonly QuestionTiming[],
  topN: number,
): readonly QuestionTiming[] {
  return [...timings]
    .filter((t) => !t.paused && t.elapsedSec > 0)
    .sort((a, b) => b.elapsedSec - a.elapsedSec)
    .slice(0, topN);
}

/** Format seconds as "M:SS" or "H:MM:SS". */
export function formatElapsed(sec: number): string {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
