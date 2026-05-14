import { Card, ProgressBar } from '@sikao/ui/ui';
import type { PracticeSectionSummaryV2, PracticeSubjectSummaryV2 } from '@sikao/api-client/types/api';

// Phase 3 ScoreModuleCard — 合并 ResultHero(score/counts) + SectionAccuracyCard +
// StrengthWeaknessCards 为单张 Figma 对齐卡片。
//
// Figma node 11:399 结构:
//   分区 1: 成绩概况 (big score + 3 stat tiles)
//   分区 2: 模块准确率 (per-section bars + strongest/weakest subject)
//   分区 3: 成绩解读 (percentile chip + interpretation, 静态占位)

export interface ScoreModuleCardProps {
  readonly score: number;
  readonly maxScore?: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly unansweredCount: number;
  readonly sections: readonly PracticeSectionSummaryV2[];
  readonly subjects: readonly PracticeSubjectSummaryV2[];
}

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(Math.max(0, Math.min(100, rate)))}%`;
}

function CountTile({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone: 'success' | 'danger' | 'neutral';
}) {
  const bg =
    tone === 'success' ? 'bg-ok-bg' : tone === 'danger' ? 'bg-bad-bg' : 'bg-surface-alt';
  const border =
    tone === 'success'
      ? 'border-ok-bg'
      : tone === 'danger'
        ? 'border-bad-bg'
        : 'border-line-3';
  const text = tone === 'success' ? 'text-ok' : tone === 'danger' ? 'text-err' : 'text-ink';
  return (
    <div
      className={`h-14 w-[60px] rounded-tiny border ${border} ${bg} px-3 py-2`}
      data-testid={`score-tile-${tone}`}
    >
      <div className="text-xs text-ink-3 leading-none">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-1 ${text}`}>{value}</div>
    </div>
  );
}

function ScoreOverview({
  score,
  maxScore,
  correctCount,
  incorrectCount,
  unansweredCount,
}: {
  readonly score: number;
  readonly maxScore: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly unansweredCount: number;
}) {
  return (
    <div className="md:w-[404px]">
      <div className="text-tiny font-bold text-ink-3 mb-3">成绩概况</div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-5xl font-bold text-ink leading-none tabular-nums">
          {score}
        </span>
        <span className="text-sm text-ink-3 mb-1">/ {maxScore}</span>
      </div>
      <div className="mt-6 border-t border-line pt-4 flex items-start gap-5">
        <div className="text-tiny text-ink-3 w-24 pt-1">答题结构</div>
        <div className="flex gap-2">
          <CountTile label="正确" value={correctCount} tone="success" />
          <CountTile label="错误" value={incorrectCount} tone="danger" />
          <CountTile label="未答" value={unansweredCount} tone="neutral" />
        </div>
      </div>
    </div>
  );
}

function ModuleAccuracy({ sections }: { readonly sections: readonly PracticeSectionSummaryV2[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-4 md:w-[232px]">
      <div>
        <h3 className="font-bold text-2xl text-ink">分项准确率</h3>
        <p className="text-xs text-ink-3 mt-2">从最低项开始复盘，避免平均用力。</p>
      </div>
      <div className="space-y-3">
        {sections.map((sec) => {
          const pct = formatPercent(sec.accuracyRate);
          const isDanger = sec.accuracyRate < 60;
          return (
            <div key={sec.sectionId} data-testid={`score-module-row-${sec.sectionId}`}>
              <div className="grid grid-cols-[72px_92px_42px] items-center gap-2 text-sm">
                <span className={`font-semibold truncate ${isDanger ? 'text-err' : 'text-ink'}`}>
                  {sec.title}
                </span>
                <ProgressBar
                  value={sec.accuracyRate}
                  max={100}
                  size="sm"
                  ariaLabel={`${sec.title} 正确率`}
                  className={isDanger ? '[&>div]:bg-err' : undefined}
                />
                <span className="text-xs leading-tight tabular-nums text-right">
                  <span className="block text-ink-3">{sec.correctCount}/{sec.questionCount}</span>
                  <b className={isDanger ? 'text-err' : 'text-ink'}>{pct}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectCompare({ subjects }: { readonly subjects: readonly PracticeSubjectSummaryV2[] }) {
  const answered = subjects.filter((s) => s.answeredQuestions > 0);
  if (answered.length < 2) return null;
  const sorted = [...answered].sort((a, b) => b.accuracyRate - a.accuracyRate);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  if (strongest.subject === weakest.subject) return null;

  const items = [
    { label: '强项', subject: strongest, tone: 'success' as const, testId: 'score-module-strongest' },
    { label: '需巩固', subject: weakest, tone: 'danger' as const, testId: 'score-module-weakest' },
  ];

  return (
    <div className="mt-5 pt-4 border-t border-line space-y-2">
      {items.map(({ label, subject, tone, testId }) => (
        <div
          key={label}
          className="flex items-center gap-3 text-sm"
          data-testid={testId}
        >
          <span
            className={`text-tiny font-bold shrink-0 ${tone === 'success' ? 'text-ok' : 'text-err'}`}
          >
            {label}
          </span>
          <span className="font-semibold text-ink truncate">{subject.subject}</span>
          <span className="text-ink-3 tabular-nums ml-auto shrink-0 text-xs">
            准确率 {formatPercent(subject.accuracyRate)}
            {tone === 'danger' ? ` · 错 ${subject.wrongCount} 题` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScoreInterpretation() {
  // Phase 3: percentile chip + 解读文字 static placeholder.
  // Backend 未提供 percentile 字段，先隐藏。
  return null;
}

export function ScoreModuleCard(props: ScoreModuleCardProps) {
  const { score, maxScore = 100, correctCount, incorrectCount, unansweredCount } = props;
  return (
    <Card padding="lg" data-testid="score-module-card" className="min-h-[276px]">
      <div className="md:grid md:grid-cols-[minmax(0,404px)_1px_minmax(0,232px)] md:gap-6">
        <ScoreOverview
          score={score}
          maxScore={maxScore}
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          unansweredCount={unansweredCount}
        />
        <div className="hidden md:block bg-line" aria-hidden="true" />
        <ModuleAccuracy sections={props.sections} />
      </div>
      <SubjectCompare subjects={props.subjects} />
      <ScoreInterpretation />
    </Card>
  );
}
