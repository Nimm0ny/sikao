import { Card, Tooltip } from '@sikao/ui/ui';
import type { PracticeSubtypeSummaryV2 } from '@sikao/api-client/types/api';

// Mirrors design/scenes/result.jsx ResultC §185-200 — "错题集中 · 知识点" card.
// Per docs/plan/result-deep-analysis.md slice 3 (D3.B 两层 — subject + subtype).
//
// 卡片只展示有错题的 subtype（wrong_count > 0）, 按 wrong_count desc 排序.
// 没错题就完全不渲染 (return null), 避免给用户"你哪都强"的虚假信号.

const DEFAULT_TOP_N = 5;

export interface KnowledgePointFocusProps {
  readonly subtypes: readonly PracticeSubtypeSummaryV2[];
  readonly topN?: number;
  /** Click row → e.g. jump to wrong-book filtered by subject + subtype. */
  readonly onSelect?: (subject: string | null, subtype: string) => void;
}

interface RowProps {
  readonly summary: PracticeSubtypeSummaryV2;
  readonly maxWrong: number;
  readonly onSelect?: (subject: string | null, subtype: string) => void;
}

function Row({ summary, maxWrong, onSelect }: RowProps) {
  // Bar value scales relative to the worst subtype in the visible list — so
  // the top row always shows full width, others show proportional. Avoids
  // confusion where small absolute counts (e.g. 1 wrong) read as "barely a
  // problem" against a 100-question paper denominator.
  const barValue = maxWrong > 0 ? (summary.wrongCount / maxWrong) * 100 : 0;
  // truthy check 同时挡住 null + undefined (后端 response_model_exclude_none=True
  // 会移除 null 字段, FE 收到的是 undefined 不是 null)
  const display = summary.subject ? `${summary.subject} · ${summary.subtype}` : summary.subtype;
  const handleClick =
    onSelect === undefined ? undefined : () => onSelect(summary.subject, summary.subtype);
  const inner = (
    <>
      <div className="flex items-baseline justify-between mb-2 text-sm">
        <Tooltip label={display}>
          <span className="font-medium text-ink truncate">{display}</span>
        </Tooltip>
        <span
          className="tabular-nums font-bold text-err shrink-0 ml-3"
          data-testid={`kp-focus-wrong-${summary.subtype}`}
        >
          ×{summary.wrongCount}
        </span>
      </div>
      {/* danger-colored bar — ProgressBar 没有 danger variant, 直接走 div + token. */}
      <div
        className="h-1 rounded-pill bg-line overflow-hidden"
        role="progressbar"
        aria-label={`${display} 错题数`}
        aria-valuenow={summary.wrongCount}
        aria-valuemin={0}
        aria-valuemax={maxWrong}
      >
        <div className="h-full bg-err transition-all" style={{ width: `${barValue}%` }} /></div>
    </>
  );
  if (handleClick === undefined) {
    return (
      <div className="py-3 border-b border-line last:border-b-0" data-testid={`kp-focus-row-${summary.subtype}`}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`查看 ${display} 错题`}
      className="w-full text-left py-3 border-b border-line last:border-b-0 hover:bg-surface-alt transition-colors px-2 -mx-2 rounded-tiny"
      data-testid={`kp-focus-row-${summary.subtype}`}
    >
      <svg className="sr-only" width={1} height={1} aria-hidden="true">
        <path d="M0 0h1" />
      </svg>
      {inner}
    </button>
  );
}

export function KnowledgePointFocus({ subtypes, topN = DEFAULT_TOP_N, onSelect }: KnowledgePointFocusProps) {
  const wrong = [...subtypes]
    .filter((s) => s.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, topN);
  if (wrong.length === 0) return null;
  const maxWrong = wrong[0].wrongCount;
  return (
    <Card padding="md" data-testid="knowledge-point-focus">
      <h3 className="font-bold text-ink mb-3">错题集中 · 知识点</h3>
      <div>
        {wrong.map((s) => (
          <Row
            key={`${s.subject ?? '_none'}-${s.subtype}`}
            summary={s}
            maxWrong={maxWrong}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Card>
  );
}
