// EssayHistory — Slice 2d /essay/history 我的批改历史 view.
//
// 拉 GET /api/v2/essay/grades (latest 20 DESC), 用 EssayHistoryRow (Slice

import { useQuery } from '@tanstack/react-query';
import { FileTextIcon, LayersIcon } from '@sikao/ui/icons';
import { EmptyState, PageHeader, Skeleton } from '@sikao/ui/ui';
import { QueryBoundary } from '@/components/data';
import {
  essayGradingKeys,
  fetchMyEssayGradings,
} from '@sikao/api-client/apiQueries';
import { ERROR_COPY, ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { EssayHistoryRow } from '@/components/essay/EssayHistoryRow';
import { groupByExamSession } from '@/components/essay/groupByExamSession';

export default function EssayHistory() {
  const query = useQuery({
    queryKey: essayGradingKeys.list(),
    queryFn: fetchMyEssayGradings,
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        eyebrow="History · 思考"
        title={ESSAY_GRADING_COPY.historyTitle}
      />

      <QueryBoundary
        query={query}
        testId="essay-history"
        skeleton={
          <div className="space-y-2">
            <Skeleton heightClass="h-14" />
            <Skeleton heightClass="h-14" />
            <Skeleton heightClass="h-14" />
          </div>
        }
        errorTitle={ERROR_COPY.essayHistory.title}
        errorDescription={ERROR_COPY.essayHistory.description}
        emptyWhen={(items) => items.length === 0}
        emptyState={
          <EmptyState
            icon={<FileTextIcon className="w-8 h-8" />}
            title={ESSAY_GRADING_COPY.historyEmpty}
            description="去「申论真题」选一题开始练笔."
          />
        }
      >
        {(items) => {
          // review P1 #2 — 30s 时间窗 best-effort 整卷模考聚合 hint. 单题
          // 练习每条独立, 整卷模考 N 条紧贴 + eyebrow 标记. 0 BE 改 (D2=A).
          const groups = groupByExamSession(items);
          return (
            <ul className="space-y-6" data-testid="essay-history-list">
              {groups.map((group, gi) => (
                <li
                  key={group.records[0].id}
                  data-testid={
                    group.isExamSession
                      ? `essay-history-group-exam-${gi}`
                      : `essay-history-group-single-${gi}`
                  }
                >
                  {group.isExamSession ? (
                    <div className="flex items-center gap-2 text-tiny font-mono tracking-loose text-ink-3 mb-2">
                      <LayersIcon
                        className="w-3.5 h-3.5"
                      />
                      <span>整卷模考 · {group.records.length} 题</span>
                    </div>
                  ) : null}
                  <ul className="space-y-2">
                    {group.records.map((record) => (
                      <li key={record.id}>
                        <EssayHistoryRow record={record} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
