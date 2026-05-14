import DOMPurify from 'dompurify';
import { EmptyState } from '@sikao/ui/ui';
import type { WrongQuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 5.5 —— 仪表盘底部"最近错题"小列表。复用 WrongBook API 的 page=1,
// pageSize=5 结果。每项给到 /wrong-book 深度页的跳转提示。

export interface RecentWrongQuestionsProps {
  readonly items: readonly WrongQuestionDetailV2[];
  readonly onNavigate: () => void;
}

export function RecentWrongQuestions({ items, onNavigate }: RecentWrongQuestionsProps) {
  return (
    <section
      className="bg-surface border border-line p-4"
      data-testid="recent-wrong-questions"
      aria-label="最近错题"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink">最近错题</h3>
        <button
          type="button"
          onClick={onNavigate}
          className="text-sm text-ink-3 hover:text-ink transition-colors"
        >
          去错题本 <span className="font-serif italic">→</span>
        </button>
      </header>
      {items.length === 0 ? (
        <EmptyState
          title="还没有错题"
          description="完成一次练习后错题会自动收录。"
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.questionId}>
              <button
                type="button"
                className="py-3 w-full flex items-start gap-3 cursor-pointer hover:bg-surface-alt px-2 -mx-2 transition-colors text-left"
                onClick={onNavigate}
              >
                <span className="text-tiny font-mono text-ink-4 tracking-eyebrow shrink-0 mt-1">
                  {item.subject ?? item.questionKind}
                </span>
                <span className="text-sm text-ink line-clamp-2 flex-1">
                  {DOMPurify.sanitize(item.stem, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
                </span>
                <span className="text-tiny text-err font-serif italic shrink-0 mt-1">
                  ×{item.wrongCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
