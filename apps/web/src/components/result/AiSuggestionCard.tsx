import type { PracticeSubtypeSummaryV2 } from '@sikao/api-client/types/api';

// Phase 4.7 fenbi-merge — 重构为浅蓝渐变 banner (对齐 prototype 07
// .ai-banner). 旧版本是 sidebar 黑底卡放在 grid col-5; 现在升级为
// hero 下方 full-width 横条, 视觉上把"关键发现 → 跳错题本复盘"链路
// 压在最显眼位置.
//
// 建议文案仍是确定性模板 (subtype 错最多), 不接模型服务:
//   - PoC 阶段 cost / latency 不划算 (Phase 7 单独 ticket)
//   - 「每个数字都能解释」style-guide §2.4 — 模板规则透明
//
// 行为:
//   - 找错最多的 subtype (wrongCount desc, tie 用 accuracyRate asc)
//   - 整 banner 可点击 → onSelect(subject, subtype) 跳错题本筛选页
//   - 没错题 (subtype.wrongCount === 0) → return null

export interface AiSuggestionCardProps {
  readonly subtypes: readonly PracticeSubtypeSummaryV2[];
  /** Click banner → e.g. jump to wrong-book filtered by subject + subtype. */
  readonly onSelect?: (subject: string | null, subtype: string) => void;
}

export function AiSuggestionCard({ subtypes, onSelect }: AiSuggestionCardProps) {
  const wrong = [...subtypes]
    .filter((s) => s.wrongCount > 0)
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
      return a.accuracyRate - b.accuracyRate;
    });
  if (wrong.length === 0) return null;
  const target = wrong[0];
  // truthy 挡 null + undefined (response_model_exclude_none=True 让
  // null subject 在 JSON 里直接省略 → FE 看到 undefined)
  const display = target.subject ? `${target.subject} · ${target.subtype}` : target.subtype;

  const interactive = onSelect !== undefined;
  const handleClick = interactive ? () => onSelect(target.subject, target.subtype) : undefined;

  const content = (
    <>
      <span
        aria-hidden="true"
        className="shrink-0 w-8 h-8 rounded-tiny bg-ink text-white inline-flex items-center justify-center font-mono text-xs font-bold"
      >
        建议
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-tiny font-bold text-accent tracking-loose mb-1">
          关键发现
        </div>
        <div className="text-sm text-ink" data-testid="ai-suggestion-target">
          <span className="font-semibold">{display}</span>
          <span className="text-ink-3"> 错 {target.wrongCount} 题, 建议针对这个考点专项练习.</span>
        </div>
      </div>
      {interactive ? (
        <span
          className="shrink-0 text-sm font-semibold text-accent self-center"
          data-testid="ai-suggestion-cta"
          aria-hidden="true"
        >
          查看建议 →
        </span>
      ) : null}
    </>
  );

  const className =
    'flex items-start gap-3 rounded-card border border-accent/20 bg-gradient-to-b from-accent-50 to-surface p-4 md:p-5';

  if (interactive) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`${className} w-full text-left transition-colors hover:from-accent-50 hover:to-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        data-testid="ai-suggestion-card"
        aria-label={`关键发现: ${display} 错 ${target.wrongCount} 题`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} data-testid="ai-suggestion-card">
      {content}
    </div>
  );
}
