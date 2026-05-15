import { Card, EmptyState } from '@sikao/ui/ui';
import { EMPTY_COPY } from '@/lib/ui-copy';
import { WrongReviewCard } from './WrongReviewCard';
import type { QuestionDetailV2 } from '@sikao/api-client/types/api';
import type { WrongReasonCode } from './wrongReason';

// Outer Card wrapping a list of WrongReviewCard. Owns the empty state so the
// smart container doesn't have to branch on `items.length === 0` itself —
// `<WrongReviewSection items={[]} />` becomes a "无错题，全部答对" tile.

export interface WrongReviewItem {
  readonly question: QuestionDetailV2;
  readonly questionNo: number;
  readonly userKeys: readonly string[];
  readonly correctKeys: readonly string[];
  readonly categoryLabel?: string;
  readonly answerId?: number;
  readonly wrongReasonCode?: WrongReasonCode;
  readonly wrongReasonSource?: 'ai' | 'user';
  readonly needsDiagnosisSync?: boolean;
}

export interface WrongReviewSectionProps {
  readonly items: readonly WrongReviewItem[];
  /** Forward 给每张 card, 让父级持有 ref map (Result.tsx scroll 用). */
  readonly registerRef?: (questionId: string, el: HTMLElement | null) => void;
  /** PR10: "问 AI" callback, 透传 WrongReviewCard 渲染 IconBtn. */
  readonly onAsk?: (questionId: string) => void;
  readonly onSetWrongReason?: (answerId: number, code: WrongReasonCode) => void;
  readonly savingAnswerId?: number | null;
}

export function WrongReviewSection({
  items,
  registerRef,
  onAsk,
  onSetWrongReason,
  savingAnswerId,
}: WrongReviewSectionProps) {
  return (
    <Card padding="md" data-testid="wrong-review-section">
      <h3 className="font-bold text-ink mb-3">错题解析</h3>
      {items.length === 0 ? (
        <EmptyState
          title={EMPTY_COPY.wrongReview.title}
          description={EMPTY_COPY.wrongReview.description}
          className="bg-surface-alt"
        />
      ) : (
        <div className="space-y-3">
          {/* 每张错题卡之间用 hairline 分隔，改用 border-t 由卡自身担当。 */}
          {items.map((item) => {
            const qid = String(item.question.questionId);
            return (
              <WrongReviewCard
                key={qid}
                question={item.question}
                questionNo={item.questionNo}
                userKeys={item.userKeys}
                correctKeys={item.correctKeys}
                categoryLabel={item.categoryLabel}
                anchorId={`wrong-question-${qid}`}
                registerRef={
                  registerRef !== undefined ? (el) => registerRef(qid, el) : undefined
                }
                onAsk={onAsk}
                answerId={item.answerId}
                wrongReasonCode={item.wrongReasonCode}
                wrongReasonSource={item.wrongReasonSource}
                onSetWrongReason={onSetWrongReason}
                isSavingWrongReason={savingAnswerId === item.answerId}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
