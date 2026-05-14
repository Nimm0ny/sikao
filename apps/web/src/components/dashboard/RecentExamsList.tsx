import { Badge, EmptyState } from '@sikao/ui/ui';
import type { PracticeSessionSummaryV2 } from '@sikao/api-client/types/api';

// Phase 5.5 —— 最近练习列表（复用 /practice/history 的 recentSessions）。
// honesty：项目只有"练习 session"，不叫"考试"，故标题用"最近练习"。

export interface RecentExamsListProps {
  readonly sessions: readonly PracticeSessionSummaryV2[];
  readonly onOpenResult: (sessionId: string | number) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.valueOf())) return '';
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${M}-${D}`;
}

export function RecentExamsList({ sessions, onOpenResult }: RecentExamsListProps) {
  return (
    <section
      className="bg-surface border border-line p-4 h-full flex flex-col"
      data-testid="recent-exams-list"
      aria-label="最近练习"
    >
      <header className="mb-3">
        <h3 className="font-semibold text-ink">最近练习</h3>
      </header>
      {sessions.length === 0 ? (
        <EmptyState
          title="还没有练习记录"
          description="完成一场练习后，最近 10 次会出现在这里。"
        />
      ) : (
        <ul className="divide-y divide-line flex-1 overflow-auto">
          {sessions.slice(0, 10).map((s) => {
            const pct = Math.round((s.accuracyRate || 0));
            return (
              <li key={String(s.sessionId)}>
                <button
                  type="button"
                  className="py-3 w-full flex items-center gap-3 cursor-pointer hover:bg-surface-alt px-2 -mx-2 transition-colors text-left"
                  onClick={() => onOpenResult(s.sessionId)}
                >
                  <span className="text-tiny font-mono text-ink-4 tabular-nums shrink-0 w-10">
                    {formatDate(s.startedAt)}
                  </span>
                  <span className="text-sm text-ink flex-1 line-clamp-1">
                    {s.paperName ?? s.paperCode ?? '未知套卷'}
                  </span>
                  <Badge
                    tone={pct >= 80 ? 'success' : pct >= 60 ? 'warn' : 'danger'}
                    variant="hairline"
                  >
                    {pct}%
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
