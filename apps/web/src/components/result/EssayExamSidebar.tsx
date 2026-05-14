// SIKAO Wave 4 — EssayExamResults aside sidebar (整卷模考右栏).
//
// 抽出原因: EssayExamResults.tsx 触 §3.5 单文件 500 行硬约束. 此 sidebar
// + buildExamAsideCards builder 合计 ~80 行 JSX, 移出 view 减负.
//
// 行为: 直接渲染 <EssayResultAside cards={...}> 的双 card section (总览 +
// 逐题状态). 不持 hook / state, 只接收 props.

import { useMemo } from 'react';
import type { EssayGradingV2 } from '@sikao/api-client/types/api';
import type { WeightedTotal } from '@sikao/answer-engine/scoring/shenlun';
import {
  EssayResultAside,
  StatRow,
  buildExamOverviewRows,
  buildExamStatusRows,
  type AsideCardSection,
} from '@/components/result';

export interface EssayExamSidebarProps {
  readonly weighted: WeightedTotal;
  readonly submittedCount: number;
  readonly total: number;
  readonly recordIds: ReadonlyArray<number | null>;
  readonly queries: readonly { readonly data: EssayGradingV2 | undefined }[];
  readonly fullScoreByQuestionId: ReadonlyMap<number, number>;
}

export function EssayExamSidebar({
  weighted,
  submittedCount,
  total,
  recordIds,
  queries,
  fullScoreByQuestionId,
}: EssayExamSidebarProps) {
  const cards = useMemo<readonly AsideCardSection[]>(() => {
    const overviewRows = buildExamOverviewRows(weighted, submittedCount, total);
    const statusRows = buildExamStatusRows(recordIds, queries, fullScoreByQuestionId);

    const overviewBody = (
      <>
        {overviewRows.map((r) => (
          <StatRow
            key={r.testId}
            label={r.label}
            value={r.value}
            tone={r.tone}
            last={r.last}
            testId={r.testId}
          />
        ))}
      </>
    );

    const statusBody = (
      <>
        {statusRows.map((r) => (
          <StatRow
            key={r.testId}
            label={r.label}
            value={r.value}
            tone={r.tone}
            last={r.last}
            testId={r.testId}
          />
        ))}
      </>
    );

    return [
      {
        title: '总览',
        subtitle: `${total} 题`,
        body: overviewBody,
        testIdSuffix: 'overview',
      },
      {
        title: '逐题状态',
        subtitle: 'Q1 → QN',
        body: statusBody,
        testIdSuffix: 'status',
      },
    ];
  }, [weighted, submittedCount, total, recordIds, queries, fullScoreByQuestionId]);

  return <EssayResultAside cards={cards} />;
}
