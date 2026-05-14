import { Link } from 'react-router-dom';
import { Badge } from '@sikao/ui/ui';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';
import type { BadgeTone } from '@sikao/ui/ui';
import type { EssayGradingStatus, EssayGradingV2 } from '@sikao/api-client/types/api';

// Slice 2d — 历史批改单行 (dumb).
//
// status badge tone:
//   pending    → neutral (批改中, 中性等待)
//   completed  → success (绿)
//   failed     → danger  (红)
//
// 链接到 /essay/grades/{id} (deep link, 不经过 listing 中转). createdAt 按
// 本地时间显示 yyyy-mm-dd hh:mm (跟 ConversationsHistory pattern 对齐, 不上
// 重型 date lib).

const STATUS_TONE: Record<EssayGradingStatus, BadgeTone> = {
  pending: 'neutral',
  completed: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<EssayGradingStatus, string> = {
  pending: ESSAY_GRADING_COPY.statusPending,
  completed: ESSAY_GRADING_COPY.statusCompleted,
  failed: ESSAY_GRADING_COPY.statusFailed,
};

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export interface EssayHistoryRowProps {
  readonly record: EssayGradingV2;
  readonly className?: string;
}

export function EssayHistoryRow({ record, className }: EssayHistoryRowProps) {
  return (
    <Link
      to={`/essay/grades/${record.id}`}
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-card',
        'border border-line hover:border-line-3 hover:bg-surface-hover',
        'transition-colors',
        className,
      )}
      data-testid={`essay-history-row-${record.id}`}
    >
      <Badge tone={STATUS_TONE[record.status]} variant="chip">
        {STATUS_LABEL[record.status]}
      </Badge>
      <span className="flex-1 text-sm text-ink truncate">
        题 #{record.questionId}
      </span>
      {record.status === 'completed' && record.score !== null ? (
        <span
          className="font-serif text-md italic font-normal tabular-nums text-ink shrink-0"
          data-testid={`essay-history-row-score-${record.id}`}
        >
          {record.score.toFixed(1)}
        </span>
      ) : null}
      <span className="text-tiny font-mono tracking-loose text-ink-3 shrink-0">
        {formatLocalDateTime(record.createdAt)}
      </span>
    </Link>
  );
}
