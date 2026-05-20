import { Card } from '@sikao/ui/ui';
import type { PaperSummaryV2 } from '@sikao/api-client/types/api';
import { HOME_COPY } from '@/lib/ui-copy';

// EssayPreviewCard — 学习中心首页 §6 申论待批改 / 推荐区. /essay/papers 完整
// 列表是详细页, 这里只显前 2 入口让用户感知"申论模块在这里, 一键进".

interface EssayPreviewCardProps {
  readonly papers: readonly PaperSummaryV2[];
  readonly onPick: (paper: PaperSummaryV2) => void;
  readonly onSeeAll: () => void;
}

export function EssayPreviewCard({ papers, onPick, onSeeAll }: EssayPreviewCardProps) {
  if (papers.length === 0) return null;
  const preview = papers.slice(0, 2);

  return (
    <Card padding="md" data-testid="home-essay-preview">
      <header className="flex items-end justify-between mb-3 gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">
            申论真题 <span className="text-ink-3 font-semibold">· 练笔</span>
          </h2>
          <p className="text-xs text-ink-3 mt-1">
            {HOME_COPY.essayPreview}。
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm text-ink-3 hover:text-ink transition-colors shrink-0"
          data-testid="home-essay-see-all"
        >
          查看全部 →
        </button>
      </header>
      <ul className="divide-y divide-line">
        {preview.map((paper) => (
          <li key={paper.paperCode}>
            <button
              type="button"
              onClick={() => onPick(paper)}
              className="w-full flex items-center justify-between gap-3 py-3 px-2 -mx-2 hover:bg-surface-alt rounded-tiny transition-colors text-left"
              data-testid={`home-essay-item-${paper.paperCode}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink truncate">{paper.paperName}</div>
                <div className="text-xs text-ink-3 mt-1 tabular-nums">
                  {paper.questionCount} 题 · {paper.paperCode}
                </div>
              </div>
              <span className="text-tiny text-ink-3 font-semibold shrink-0">进入 →</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
