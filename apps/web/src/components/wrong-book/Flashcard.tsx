/**
 * SIKAO Wave 4 Phase 2D · 智能复盘 flashcard 翻牌.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .fcard-stack .fcard.fc-1 SmartReview.
 *
 * 单张 flashcard 显当前题 stem + meta. 翻牌 / 跳过 / 提交 走 callback (smart
 * container 调 submit-bluff + 拉 next).
 *
 * 不直接接 API — 由 SmartReviewView smart 容器拼.
 */
import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Button, Card } from '@sikao/ui/ui';
import type { SmartReviewNext } from '@sikao/api-client/queries/wrongBookQueries';

export interface FlashcardProps {
  readonly question: SmartReviewNext;
  readonly progress: { readonly done: number; readonly total: number };
  readonly onSkip: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
}

const KIND_LABEL: Record<SmartReviewNext['mode'], string> = {
  qifei: '亓菲线 · 智能推送',
  single: '单题 · 重做',
  similar: '同类 · 抽题',
  mock: '抽考 · 限时',
  danger: '险题 · 专项',
};

export function Flashcard({
  question,
  progress,
  onSkip,
  onSubmit,
  isSubmitting,
}: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <Card padding="md" data-testid="smart-review-flashcard">
      <div className="flex justify-between font-mono text-xs uppercase tracking-wider text-ink-3 mb-3">
        <span data-testid="smart-review-flashcard-progress">
          {String(progress.done + 1).padStart(2, '0')} / {progress.total}
        </span>
        <span>{KIND_LABEL[question.mode]}</span>
      </div>

      <div
        className="font-serif text-lg leading-relaxed text-ink mb-4"
        data-testid="smart-review-flashcard-stem"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(question.stem, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i'],
            ALLOWED_ATTR: [],
          }),
        }}
      />

      {question.knowledgePoint != null ? (
        <div className="font-mono text-xs text-ink-3 tracking-loose mb-4">
          {question.knowledgePoint}
        </div>
      ) : null}

      {flipped ? (
        <div className="bg-surface-alt border-l-2 border-l-ink px-4 py-3 mb-4 text-sm text-ink">
          <b className="mr-2">提示</b>
          这是连对 {question.consecutiveCorrectCount} 次的题。再做对 1 次即毕业。
        </div>
      ) : null}

      <div className="flex gap-3 pt-3 border-t border-line">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFlipped((s) => !s)}
          data-testid="smart-review-flashcard-flip"
        >
          {flipped ? '收起提示' : '翻牌看提示'}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={onSkip}
          data-testid="smart-review-flashcard-skip"
        >
          跳过
        </Button>
        <span className="flex-1" />
        <Button
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          onClick={onSubmit}
          data-testid="smart-review-flashcard-submit"
        >
          {isSubmitting ? '处理中…' : '前往做题'}
        </Button>
      </div>
    </Card>
  );
}
