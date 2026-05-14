import { ArrowUpRightIcon } from '@sikao/ui/icons';
import { Badge, Button, Card } from '@sikao/ui/ui';
import type { PaperSummaryV2, PaperUserStatusV2 } from '@sikao/api-client/types/api';

// Mirrors `Screen: Home -> 推荐套卷 article.card` in docs/ui-demo/ui-preview.html
// (§247-292). Demo cards show category badges, question count, duration and a
// difficulty rating, but PaperSummaryV2 only carries (paperCode / paperName /
// currentRevisionId / description). We render only fields the contract proves
// — fabricating counts/difficulty would violate frontend/CLAUDE.md §3.4.
//
// Phase 1 fenbi-merge: 加 status chip 三态 (D1). status 是可选 prop —
// 匿名 / 未拉到 overlay 时 fallback 为 'untouched' (展示"未做" hairline
// chip), 不强行给 caller 加复杂度.

export interface PaperListCardProps {
  readonly paper: PaperSummaryV2;
  readonly onStart: (paper: PaperSummaryV2) => void;
  /** When true (loading sibling), CTA renders disabled. */
  readonly disabled?: boolean;
  /** 来自 /papers/me/status overlay; 缺省视为 untouched (见组件注释). */
  readonly status?: PaperUserStatusV2;
}

// Trim the long revisionId into a stable short signature for display only.
// We never round-trip this back to the API. Backend returns revisionId as an
// integer primary key today (e.g. 1) but the contract may widen to opaque
// strings; accept both and coerce once at the boundary.
function shortRev(revisionId: string | number): string {
  const s = String(revisionId);
  if (s.length <= 6) return s;
  return `rev#${s.slice(0, 6)}`;
}

function StatusChip({ status }: { readonly status: PaperUserStatusV2 | undefined }) {
  // Fallback: undefined → untouched (匿名 / overlay 加载未到).
  if (status === undefined || status.userStatus === 'untouched') {
    return <Badge variant="hairline" tone="neutral">未做</Badge>;
  }
  if (status.userStatus === 'in_progress') {
    // 后端契约保证 in_progress 时 progress 必填 (见 list_paper_user_status).
    // progress missing = 契约违约, 显式 fallback to "进行中" 不假装 "已做".
    if (status.progress === undefined) {
      return <Badge tone="warn" dot>进行中</Badge>;
    }
    const { answered, total } = status.progress;
    return (
      <Badge tone="warn" dot>
        进行中 {answered}/{total}
      </Badge>
    );
  }
  // done — attempt_count ≥ 1 (后端保证).
  if (status.userStatus === 'done') {
    return (
      <Badge tone="neutral">
        {status.attemptCount > 1 ? `已做 ${status.attemptCount} 次` : '已做'}
      </Badge>
    );
  }
  // exhaustive — TS 帮我抓未来新增 status kind 时的漏分支.
  const exhaustive: never = status.userStatus;
  return exhaustive;
}

export function PaperListCard({ paper, onStart, disabled = false, status }: PaperListCardProps) {
  return (
    <Card
      as="article"
      padding="md"
      hoverable
      data-testid={`paper-card-${paper.paperCode}`}
      className="group relative"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge tone="brand">{paper.paperCode}</Badge>
        <StatusChip status={status} />
      </div>
      <div className="mt-1 text-tiny text-ink-4 font-mono">
        {shortRev(paper.currentRevisionId)}
      </div>
      <h3 className="mt-3 text-base font-bold leading-snug text-ink">{paper.paperName}</h3>
      {paper.description !== undefined && paper.description !== '' ? (
        <p className="mt-1 text-sm text-ink-3 line-clamp-2 leading-relaxed">
          {paper.description}
        </p>
      ) : null}
      {/* Phase 5.3a: element/ui_kits/app/index.html §77-79 —— 底栏左文字 + 右按钮。
          questionCount 来自真实契约（PaperSummaryV2.question_count），不编造时长/难度。 */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-3 tabular-nums">
          {paper.questionCount > 0 ? `${paper.questionCount} 题` : '题数待补'}
        </span>
        <Button
          variant="primary"
          size="sm"
          disabled={disabled}
          onClick={() => onStart(paper)}
          data-testid={`paper-start-${paper.paperCode}`}
        >
          开始练习
        </Button>
      </div>
      {/* Brand v2 PR3: hover affordance — chevron slide-in 提示「这张卡可点」.
          替代 spec 原方案 progress bar (PaperUserStatusV2 无 lastScore/totalScore
          字段, 不 fabricate 后端字段, 详 frontend/CLAUDE.md §3.4). */}
      <ArrowUpRightIcon
        className="absolute bottom-3 right-3 w-4 h-4 text-ink-3 opacity-0 -translate-x-2 transition-all duration-base ease-motion group-hover:opacity-100 group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Card>
  );
}
