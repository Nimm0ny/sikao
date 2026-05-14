import type { PracticeSubjectSummaryV2 } from '@sikao/api-client/types/api';

// SIKAO Wave 2 Phase 2 — hifi 05 "分项 · 五个考点" cat-table.
// 来源: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2901-2937 + tokens line 1020-1028.
//
// 4 列 grid: 1.4fr name / 80px pct / 1fr bar / 80px chip.
// bar fill 区分: ok 用 var(--ink-1), weak (<60%) 用 var(--accent-1).
// chip 三态:
//   稳 (>=80%)  — is-ok, --ok-bg / --ok
//   观察 (60-79%) — neutral, --paper-deep / --ink-2
//   优先 (<60%)  — is-err, --err-bg / --err (token: --danger-bg / --danger)
//
// 数据用 PracticeSubjectSummaryV2 (行测 5 模块 = subject 维度), 不用
// sectionSummaries (sectionSummaries 跟 paper section 切片数对齐, 行测真题
// 一般 1 section = 1 subject, 但用 subject 跟 hifi semantics 更对齐, 也跟
// AiSuggestionCard / KnowledgePointFocus 数据来源一致).

export interface SubjectCatTableProps {
  readonly subjects: readonly PracticeSubjectSummaryV2[];
}

interface RowVm {
  readonly subject: string;
  readonly correctCount: number;
  readonly questionCount: number;
  readonly accuracyRate: number;
  readonly status: 'ok' | 'observe' | 'priority';
}

function classifyStatus(rate: number): 'ok' | 'observe' | 'priority' {
  if (rate >= 80) return 'ok';
  if (rate < 60) return 'priority';
  return 'observe';
}

function buildRows(subjects: readonly PracticeSubjectSummaryV2[]): readonly RowVm[] {
  return subjects.map((s) => ({
    subject: s.subject,
    correctCount: s.correctCount,
    questionCount: s.questionCount,
    accuracyRate: s.accuracyRate,
    status: classifyStatus(s.accuracyRate),
  }));
}

interface StatusChipProps {
  readonly status: RowVm['status'];
}

function StatusChip({ status }: StatusChipProps) {
  // chip 三态走 inline style 直消 var() token, 避免 hardcode + 跟 hifi 语义对齐.
  // padding / radius / font 走 design system chip 节奏 (--r-sm chip / 11px mono).
  if (status === 'ok') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-tiny font-mono"
        style={{
          backgroundColor: 'var(--ok-bg)',
          color: 'var(--ok)',
          fontSize: '11px',
          letterSpacing: 'var(--tracking-wider)',
          padding: '4px 10px',
          minWidth: '52px',
        }}
        data-testid="cat-chip-ok"
      >
        稳
      </span>
    );
  }
  if (status === 'priority') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-tiny font-mono"
        style={{
          backgroundColor: 'var(--bad-bg)',
          color: 'var(--err)',
          fontSize: '11px',
          letterSpacing: 'var(--tracking-wider)',
          padding: '4px 10px',
          minWidth: '52px',
        }}
        data-testid="cat-chip-priority"
      >
        优先
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-tiny font-mono"
      style={{
        backgroundColor: 'var(--paper-3)',
        color: 'var(--ink-2)',
        fontSize: '11px',
        letterSpacing: 'var(--tracking-wider)',
        padding: '4px 10px',
        minWidth: '52px',
      }}
      data-testid="cat-chip-observe"
    >
      观察
    </span>
  );
}

interface BarProps {
  readonly accuracyRate: number;
  readonly weak: boolean;
}

function Bar({ accuracyRate, weak }: BarProps) {
  // hifi: bar 6px 高 / paper-deep 底 / ink fill 强项 / accent fill 弱项
  const pct = Math.max(0, Math.min(100, accuracyRate));
  return (
    <div
      className="relative w-full"
      style={{
        height: '6px',
        backgroundColor: 'var(--paper-3)',
      }}
      role="progressbar"
      aria-label={`正确率 ${Math.round(pct)}%${weak ? ' (弱项)' : ''}`}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: `${pct}%`,
          backgroundColor: weak ? 'var(--accent-1)' : 'var(--ink-1)',
        }}
      />
    </div>
  );
}

interface CatRowProps {
  readonly row: RowVm;
}

function CatRow({ row }: CatRowProps) {
  return (
    <div
      className="grid items-center gap-4 px-5 py-4 border-b border-line last:border-b-0"
      style={{
        gridTemplateColumns: '1.4fr 80px 1fr 80px',
      }}
      data-testid={`cat-row-${row.subject}`}
    >
      <div
        className="font-serif"
        style={{
          fontSize: '16px',
          color: 'var(--ink-1)',
        }}
      >
        {row.subject} · {row.questionCount} 题
      </div>
      <div
        className="font-mono tabular-nums"
        style={{
          fontSize: '14px',
          color: 'var(--ink-2)',
        }}
      >
        {row.correctCount} / {row.questionCount}
      </div>
      <Bar accuracyRate={row.accuracyRate} weak={row.status === 'priority'} />
      <div className="flex justify-start">
        <StatusChip status={row.status} />
      </div>
    </div>
  );
}

export function SubjectCatTable({ subjects }: SubjectCatTableProps) {
  if (subjects.length === 0) return null;
  const rows = buildRows(subjects);
  return (
    <div data-testid="subject-cat-table">
      <h3
        className="font-serif"
        style={{
          fontSize: '22px',
          fontWeight: 500,
          margin: '0 0 16px',
          color: 'var(--ink-1)',
        }}
      >
        分项 · {rows.length === 1 ? '单考点' : `${rows.length} 个考点`}
      </h3>
      <div className="border border-line">
        {/* 表头 */}
        <div
          className="grid items-center gap-4 px-5 py-3 border-b border-line bg-paper-3 font-mono uppercase"
          style={{
            gridTemplateColumns: '1.4fr 80px 1fr 80px',
            fontSize: '11px',
            letterSpacing: 'var(--tracking-wider)',
            color: 'var(--ink-3)',
          }}
        >
          <div>考点</div>
          <div>得分</div>
          <div>得分率</div>
          <div>建议</div>
        </div>
        {rows.map((r) => <CatRow key={r.subject} row={r} />)}
      </div>
    </div>
  );
}
