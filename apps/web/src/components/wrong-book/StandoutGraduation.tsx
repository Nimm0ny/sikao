/**
 * SIKAO Wave 4 Phase 2D · 主页 standout — 今日毕业候选.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .so .gradc MainPage.
 *
 * 显毕业候选 (consecutive_correct_count==2), 再做对 1 次即毕业. 3 题 dot
 * 进度 + 跳详情 + "一键全做" CTA.
 *
 * 接 useGraduationCandidates(limit=3).
 */
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '@sikao/ui/ui';
import type { GraduationCandidate } from '@sikao/api-client/queries/wrongBookQueries';
import { WRONG_BOOK_COPY } from '@/lib/ui-copy';

export interface StandoutGraduationProps {
  readonly candidates: readonly GraduationCandidate[];
  readonly isLoading: boolean;
}

export function StandoutGraduation({
  candidates,
  isLoading,
}: StandoutGraduationProps) {
  const navigate = useNavigate();

  return (
    <Card
      padding="md"
      variant="muted"
      data-testid="wrong-book-standout-graduation"
    >
      <header className="flex items-baseline justify-between mb-3">
        <h4 className="font-serif font-semibold text-h-card text-ink m-0">
          {WRONG_BOOK_COPY.graduationTodayTitle}
        </h4>
        <span className="text-tiny font-mono uppercase tracking-eyebrow text-ink-3">
          还差一次
        </span>
      </header>
      <p className="text-xs text-ink-3 leading-relaxed mb-3">
        {WRONG_BOOK_COPY.graduationHintLead} 2 次 — 再做对 1 次即从错题本毕业。
      </p>
      {isLoading ? (
        <div className="text-sm text-ink-3 py-4">加载中…</div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title={WRONG_BOOK_COPY.graduationEmpty}
          description={`${WRONG_BOOK_COPY.graduationEmptyHint}。`}
        />
      ) : (
        <div className="flex flex-col gap-2" data-testid="wrong-book-grad-list">
          {candidates.map((c) => (
            <button
              key={c.questionId}
              type="button"
              onClick={() => navigate(`/wrong-book/${c.questionId}/redo`)}
              className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 bg-surface border border-line text-left transition-colors duration-fast hover:bg-ok-bg hover:border-ok rounded-tiny"
              data-testid={`wrong-book-grad-${c.questionId}`}
              aria-label={`立做：${c.stem}`}
            >
              <span
                className="inline-flex gap-1 items-center"
                aria-hidden="true"
              >
                <span
                  className="w-2 h-2 rounded-pill bg-ok border border-ok"
                  data-pattern="dot"
                />
                <span
                  className="w-2 h-2 rounded-pill bg-ok border border-ok"
                  data-pattern="dot"
                />
                <span
                  className="w-2 h-2 rounded-pill border border-ok border-dashed"
                  data-pattern="dot"
                />
              </span>
              <div className="min-w-0">
                <div className="font-serif text-sm text-ink truncate">
                  {c.stem}
                </div>
                {c.knowledgePoint != null ? (
                  <div className="font-mono text-xs text-ink-3 mt-1 tracking-loose">
                    {c.knowledgePoint}
                  </div>
                ) : null}
              </div>
              <span className="font-mono text-xs uppercase tracking-wider text-ink font-semibold">
                立做
              </span>
            </button>
          ))}
        </div>
      )}
      {candidates.length > 0 ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate(`/wrong-book/${candidates[0]?.questionId ?? 0}/redo`)
            }
            data-testid="wrong-book-grad-batch"
          >
            一键全做 {candidates.length} 题
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
