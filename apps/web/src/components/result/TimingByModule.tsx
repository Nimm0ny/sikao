import { Card } from '@sikao/ui/ui';
import { formatElapsed, type QuestionTiming } from '@sikao/shared-utils';
import type { PracticeSectionSummaryV2, QuestionDetailV2 } from '@sikao/api-client/types/api';
import { RESULT_COPY } from '@/lib/ui-copy';

// Phase 4.6 fenbi-merge — 模块级用时分析横条 (对齐 prototype 07
// .module-row 节奏). 每行: 模块名 / 进度条 (实际用时 vs max) / 数值
// (实际/推荐分钟). 实际超推荐 → 条变 danger 红 + 数值红.
//
// 推荐用时数据源: 行测 5 模块固定配置 (公考行业经验, 总 120 分钟).
// 不在 BE 配置 — 全国行测各省考时长一致 (副省/地市), 静态常量更简单.
// 不在 RECOMMENDED_MINUTES 里的 section title 跳过 (例: 申论 / 自定义
// 刷题), 让卡片只对适用场景出现, 不出现 "未知模块: undefined" 兜底.

const RECOMMENDED_MINUTES: Readonly<Record<string, number>> = {
  常识判断: 15,
  常识: 15,
  言语理解: 35,
  言语理解与表达: 35,
  言语: 35,
  数量关系: 20,
  数量: 20,
  判断推理: 35,
  判断: 35,
  资料分析: 25,
  资料: 25,
};

export interface TimingByModuleProps {
  readonly timings: readonly QuestionTiming[];
  readonly sections: readonly PracticeSectionSummaryV2[];
  readonly questions: readonly QuestionDetailV2[];
}

interface ModuleRow {
  readonly sectionId: string;
  readonly title: string;
  /** ceil(sec/60) — 公考惯例: 用了多少分钟 ≈ 占了多少分钟 quota (review-fix #5). */
  readonly actualMinutes: number;
  readonly actualSec: number;
  readonly recommendedMinutes: number;
  readonly overTime: boolean;
}

function buildRows(
  timings: readonly QuestionTiming[],
  sections: readonly PracticeSectionSummaryV2[],
  questions: readonly QuestionDetailV2[],
): { readonly rows: readonly ModuleRow[]; readonly skippedTitles: readonly string[] } {
  const sectionByQid = new Map<string, string>(
    questions.map((q) => [String(q.questionId), q.sectionId]),
  );
  const secsBySectionId = new Map<string, number>();
  for (const t of timings) {
    if (t.paused) continue;
    const sid = sectionByQid.get(t.questionId);
    if (sid === undefined) continue;
    secsBySectionId.set(sid, (secsBySectionId.get(sid) ?? 0) + t.elapsedSec);
  }
  const rows: ModuleRow[] = [];
  const skippedTitles: string[] = [];
  for (const s of sections) {
    const recommended = RECOMMENDED_MINUTES[s.title];
    if (recommended === undefined) {
      // review-fix #6: 部分匹配时不静默丢, 收集让 footer hint 显示
      skippedTitles.push(s.title);
      continue;
    }
    const actualSec = secsBySectionId.get(s.sectionId) ?? 0;
    const actualMinutes = Math.ceil(actualSec / 60);
    rows.push({
      sectionId: s.sectionId,
      title: s.title,
      actualMinutes,
      actualSec,
      recommendedMinutes: recommended,
      overTime: actualMinutes > recommended,
    });
  }
  return { rows, skippedTitles };
}

interface RowProps {
  readonly row: ModuleRow;
  readonly maxMinutes: number;
}

function Row({ row, maxMinutes }: RowProps) {
  const fillPct = maxMinutes > 0 ? Math.min(100, (row.actualMinutes / maxMinutes) * 100) : 0;
  const recommendPct =
    maxMinutes > 0 ? Math.min(100, (row.recommendedMinutes / maxMinutes) * 100) : 0;
  return (
    <div
      className="grid grid-cols-[80px_1fr_72px] items-center gap-3 py-2"
      data-testid={`timing-module-row-${row.sectionId}`}
    >
      <div className="text-sm font-medium text-ink truncate">{row.title}</div>
      <div className="relative h-2 bg-surface-alt rounded-pill overflow-visible">
        <div
          className={`absolute inset-y-0 left-0 rounded-pill ${row.overTime ? 'bg-err' : 'bg-accent'}`}
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-px bg-ink-3 opacity-60"
          style={{ left: `${recommendPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div
        className={`font-mono text-xs tabular-nums text-right ${row.overTime ? 'text-err font-semibold' : 'text-ink-3'}`}
      >
        {row.actualMinutes}
        <span className="text-ink-4 font-normal">/{row.recommendedMinutes}</span>
      </div>
    </div>
  );
}

export function TimingByModule({ timings, sections, questions }: TimingByModuleProps) {
  const { rows, skippedTitles } = buildRows(timings, sections, questions);
  if (rows.length === 0) return null;
  const maxMinutes = rows.reduce(
    (acc, r) => Math.max(acc, r.actualMinutes, r.recommendedMinutes),
    0,
  );
  // review-fix #4: 用原始 actualSec - recommendedMinutes*60 求和, 不用 round
  // 后的分钟差累积, 避免每模块 ±30s 误差.
  const overSec = rows
    .filter((r) => r.overTime)
    .reduce((acc, r) => acc + (r.actualSec - r.recommendedMinutes * 60), 0);

  return (
    <Card padding="md" data-testid="timing-by-module">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-bold text-ink">用时分析</h3>
          <p className="text-xs text-ink-3 mt-1">{RESULT_COPY.timingPerModule} vs 推荐</p>
        </div>
        {overSec > 0 ? (
          <span className="text-xs text-err" data-testid="timing-by-module-over">
            超时 {formatElapsed(overSec)}
          </span>
        ) : null}
      </div>
      <div>{rows.map((r) => <Row key={r.sectionId} row={r} maxMinutes={maxMinutes} />)}</div>
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
        <span aria-hidden="true" className="inline-block w-2 h-px bg-ink-3 opacity-60" />
        推荐用时
        {skippedTitles.length > 0 ? (
          <span className="ml-auto" data-testid="timing-by-module-skipped">
            {skippedTitles.length} {RESULT_COPY.timingUntrackedSuffix}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
