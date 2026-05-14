import { Badge, Card } from '@sikao/ui/ui';
import { formatElapsed, type QuestionTiming } from '@sikao/shared-utils';

// Mirrors design/scenes/result.jsx ResultC §172-184 — "用时最久 · TOP 5"
// card. Per docs/plan/result-deep-analysis.md slice 2.
//
// What this card does NOT show (slice 3 will fill in):
//   - subject / canonical_subtype labels (e.g. "言语·片段阅读") — the
//     backend currently doesn't expose these on PaperQuestionItemV2;
//     slice 3 schema-additive change will land them. For now we show
//     just "#42" + elapsed.

const DEFAULT_HOT_THRESHOLD_SEC = 180; // 3 min

export interface SlowestQuestionsProps {
  readonly slowest: readonly QuestionTiming[];
  /** Click row → jump to question (e.g. answer card panel anchor scroll). */
  readonly onSelect?: (questionId: string) => void;
  /** Elapsed > threshold → display in danger color. Default 180s. */
  readonly hotThresholdSec?: number;
}

interface RowProps {
  readonly timing: QuestionTiming;
  readonly hot: boolean;
  readonly onSelect?: (questionId: string) => void;
}

function Row({ timing, hot, onSelect }: RowProps) {
  const handleClick = onSelect === undefined ? undefined : () => onSelect(timing.questionId);
  const elapsed = formatElapsed(timing.elapsedSec);
  const className =
    'flex items-center justify-between py-3 border-b border-line last:border-b-0 text-sm';
  const inner = (
    <>
      <span className="text-ink">#{timing.questionNo}</span>
      <span
        className={`tabular-nums font-semibold ${hot ? 'text-err' : 'text-ink'}`}
        data-testid={`slowest-elapsed-${timing.questionId}`}
      >
        {elapsed}
      </span>
    </>
  );
  if (handleClick === undefined) {
    return (
      <div className={className} data-testid={`slowest-row-${timing.questionId}`}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${className} w-full text-left hover:bg-surface-alt transition-colors`}
      data-testid={`slowest-row-${timing.questionId}`}
    >
      {inner}
    </button>
  );
}

export function SlowestQuestions({
  slowest,
  onSelect,
  hotThresholdSec = DEFAULT_HOT_THRESHOLD_SEC,
}: SlowestQuestionsProps) {
  if (slowest.length === 0) return null;
  const minutes = Math.round(hotThresholdSec / 60);
  return (
    <Card padding="md" data-testid="slowest-questions">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-ink">用时最久 · TOP {slowest.length}</h3>
        <Badge tone="neutral">超 {minutes} 分钟标红</Badge>
      </div>
      <div>
        {slowest.map((t) => (
          <Row
            key={t.questionId}
            timing={t}
            hot={t.elapsedSec > hotThresholdSec}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Card>
  );
}
