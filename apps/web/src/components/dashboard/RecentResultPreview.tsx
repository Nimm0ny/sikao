import { Link } from 'react-router-dom';
import { Card } from '@sikao/ui/ui/Card';
import type {
  PracticeSessionSummaryV2,
  PracticeSubtypeSummaryV2,
} from '@sikao/api-client/types/api';
import { cn } from '@sikao/shared-utils';

export interface RecentResultPreviewProps {
  readonly session: PracticeSessionSummaryV2 | null;
  readonly subtypes: readonly PracticeSubtypeSummaryV2[];
  readonly className?: string;
}

const FALLBACK_HINTS: readonly string[] = [
  '完成更多练习以解锁个性化建议',
  '建议先打通一套完整模考，让系统沉淀基线数据',
  '建议: 错题本回顾上一阶段难点，再触发新材料',
];

const ACTION_HINT = '建议: 错题本针对前两个考点优先重做 (≥30 题), 后续再触发新材料';

function formatLabel(subtype: PracticeSubtypeSummaryV2): string {
  return subtype.subject ? `${subtype.subject}·${subtype.subtype}` : subtype.subtype;
}

function buildHints(subtypes: readonly PracticeSubtypeSummaryV2[]): readonly string[] {
  if (subtypes.length === 0) return FALLBACK_HINTS;

  const sortedByWrong = [...subtypes].sort((a, b) => {
    if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
    return a.accuracyRate - b.accuracyRate;
  });

  const weakest = sortedByWrong[0];
  const hint1 = `${formatLabel(weakest)} 错 ${weakest.wrongCount} 题, 这是当前最大弱项`;

  if (sortedByWrong.length < 2) {
    return [hint1, FALLBACK_HINTS[1], ACTION_HINT];
  }

  const second = sortedByWrong[1];
  const pct = Math.round(second.accuracyRate);
  const hint2 = `${formatLabel(second)} 正确率 ${pct}%, 巩固空间大`;

  return [hint1, hint2, ACTION_HINT];
}

function diffMinutes(startedAt: string, completedAt: string | null): number | null {
  if (completedAt == null) return null;
  const start = new Date(startedAt).valueOf();
  const end = new Date(completedAt).valueOf();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.round((end - start) / 60000));
}

function EmptyVariant({ className }: { readonly className?: string }) {
  return (
    <Card
      as="section"
      padding="md"
      className={cn('flex flex-col gap-3', className)}
      data-testid="recent-result-preview"
      aria-label="最近一次模考"
    >
      <div className="text-tiny uppercase tracking-wider text-ink-3">
        最近一次模考
      </div>
      <p className="text-sm text-ink-2 leading-relaxed">
        暂无练习记录, 完成首场练习后这里会显示最近一次表现.
      </p>
      <div className="mt-1 text-right">
        <Link
          to="/papers"
          className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-tiny"
          data-testid="recent-result-preview-empty-link"
        >
          去做一套 →
        </Link>
      </div>
    </Card>
  );
}

export function RecentResultPreview({
  session,
  subtypes,
  className,
}: RecentResultPreviewProps) {
  if (session == null || subtypes.length === 0) {
    return <EmptyVariant className={className} />;
  }

  const hints = buildHints(subtypes);
  const minutes = diffMinutes(session.startedAt, session.completedAt);
  const title = session.paperName ?? session.paperCode ?? '未命名练习';
  const metaParts: string[] = [`${session.totalQuestions} 题`];
  if (minutes != null) metaParts.push(`用时 ${minutes} min`);
  const meta = metaParts.join(' · ');
  const resultHref = `/practice/result/${session.sessionId}`;

  return (
    <Card
      as="section"
      padding="md"
      className={cn('flex flex-col gap-3', className)}
      data-testid="recent-result-preview"
      aria-label="最近一次模考"
    >
      <div className="text-tiny uppercase tracking-wider text-ink-3">
        最近一次模考
      </div>
      <div>
        <h3
          className="font-serif text-lg font-medium text-ink leading-snug line-clamp-2"
          data-testid="recent-result-preview-title"
        >
          {title}
        </h3>
        <div className="mt-1 text-sm text-ink-3 tabular-nums">{meta}</div>
      </div>
      <ol
        className="space-y-2 text-sm text-ink-2 leading-relaxed list-none pl-0"
        data-testid="recent-result-preview-hints"
      >
        {hints.map((hint, idx) => (
          <li key={idx} className="flex gap-2">
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-tiny text-ink-3 tabular-nums"
            >
              {idx + 1}.
            </span>
            <span className="flex-1">{hint}</span>
          </li>
        ))}
      </ol>
      <div className="mt-1 text-right">
        <Link
          to={resultHref}
          className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-tiny"
          data-testid="recent-result-preview-link"
        >
          查看完整 →
        </Link>
      </div>
    </Card>
  );
}
