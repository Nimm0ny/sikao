import { Card } from '@sikao/ui/ui';
import { formatElapsed, type QuestionTiming } from '@sikao/shared-utils';

// Mirrors design/scenes/result.jsx ResultC §150-170 — horizontal timeline
// where each question is a vertical bar, width ∝ elapsedSec, color = state.
// Per docs/plan/result-deep-analysis.md slice 2 (D4: timeline over radar).
//
// "Paused" questions (elapsed > 10 min, see lib/timing.ts) are excluded
// from the bar — they'd render as zero-width slivers anyway, plus their
// real elapsed isn't meaningful (user stepped away). Instead we surface
// a count chip next to the title so the data isn't silently dropped.

export interface TimingTimelineSectionLabel {
  readonly title: string;
  readonly fromNo: number;
  readonly toNo: number;
}

export interface TimingTimelineProps {
  readonly timings: readonly QuestionTiming[];
  readonly wrongIds: ReadonlySet<string>;
  readonly unansweredIds: ReadonlySet<string>;
  readonly sectionLabels: readonly TimingTimelineSectionLabel[];
}

type SegmentState = 'correct' | 'wrong' | 'empty';

function classifyState(
  qid: string,
  wrongIds: ReadonlySet<string>,
  unansweredIds: ReadonlySet<string>,
): SegmentState {
  if (wrongIds.has(qid)) return 'wrong';
  if (unansweredIds.has(qid)) return 'empty';
  return 'correct';
}

const STATE_BG: Record<SegmentState, string> = {
  // 用语义 token, 不写死蓝/红/灰. correct 用主品牌色 (ink), wrong 用 danger,
  // empty 用 line (灰). 跟 design/scenes/result.jsx ResultC 一致.
  correct: 'bg-ink-1',
  wrong: 'bg-err',
  empty: 'bg-line',
};

interface SegmentProps {
  readonly timing: QuestionTiming;
  readonly state: SegmentState;
  readonly totalSec: number;
}

function Segment({ timing, state, totalSec }: SegmentProps) {
  // flex-grow 直接按 elapsedSec; 总和 = totalSec. CSS flex 自动归一化.
  // 最小宽 (min-w-px) 保证 1 秒的题也可见.
  const flex = totalSec > 0 ? timing.elapsedSec : 1;
  return (
    <div
      data-testid={`timing-segment-${timing.questionId}`}
      className={`h-full min-w-px ${STATE_BG[state]} ${state === 'correct' ? 'opacity-85' : ''}`}
      style={{ flexGrow: flex, flexShrink: 1, flexBasis: 0 }}
      title={`#${timing.questionNo} · ${formatElapsed(timing.elapsedSec)}`}
      aria-label={`第 ${timing.questionNo} 题 用时 ${formatElapsed(timing.elapsedSec)} ${state === 'wrong' ? '错' : state === 'empty' ? '未答' : '对'}`}
    />
  );
}

export function TimingTimeline({
  timings,
  wrongIds,
  unansweredIds,
  sectionLabels,
}: TimingTimelineProps) {
  if (timings.length === 0) return null;

  const active = timings.filter((t) => !t.paused);
  const pausedCount = timings.length - active.length;
  const totalSec = active.reduce((acc, t) => acc + t.elapsedSec, 0);

  return (
    <Card padding="md" data-testid="timing-timeline">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-ink">每题用时</h3>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          {pausedCount > 0 ? (
            <span data-testid="timing-paused-count">暂停 {pausedCount} 次</span>
          ) : null}
          <span className="tabular-nums">总 {formatElapsed(totalSec)}</span>
        </div>
      </div>
      <div
        className="flex h-14 rounded-card overflow-hidden bg-surface-alt"
        role="img"
        aria-label="每题用时分布条"
      >
        {active.map((t) => (
          <Segment
            key={t.questionId}
            timing={t}
            state={classifyState(t.questionId, wrongIds, unansweredIds)}
            totalSec={totalSec}
          />
        ))}
      </div>
      {sectionLabels.length > 0 ? (
        <div className="flex justify-between mt-2 text-xs text-ink-3 tabular-nums">
          {sectionLabels.map((s) => (
            <span key={`${s.title}-${s.fromNo}`}>
              {s.title} {s.fromNo}-{s.toNo}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
