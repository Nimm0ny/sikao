import DOMPurify from 'dompurify';
import { Badge, Button, IconBtn, OptionRow } from '@sikao/ui/ui';
import { ToolAiIcon } from '@sikao/ui/icons';
import { LLM_QA_COPY } from '@/lib/ui-copy';
import type { QuestionDetailV2, QuestionOption } from '@sikao/api-client/types/api';

// Phase 5.3d rewrite —— 从"整卡红色底" editorial 化：hairline 白卡 +
// 左 border-l-4 danger 状态条 + Badge hairline 错题标签 + 选项用 OptionRow
// primitive（correct → 绿 / userWrong → 红 / 其他 neutral）。
//
// Sanitize 保留（frontend/CLAUDE.md §2.5）。

export interface WrongReviewCardProps {
  readonly question: QuestionDetailV2;
  readonly questionNo: number;
  readonly userKeys: readonly string[];
  readonly correctKeys: readonly string[];
  readonly categoryLabel?: string;
  /** 答题卡跳转用 anchor id, e.g. "wrong-question-123" */
  readonly anchorId?: string;
  /** ref callback, Result 持有 wrongRefs map */
  readonly registerRef?: (el: HTMLElement | null) => void;
  /** "查看完整解析" CTA callback */
  readonly onViewDetail?: (questionId: string) => void;
  /** PR10: "问 AI" callback. 在 WrongHeader 右侧渲染 IconBtn. */
  readonly onAsk?: (questionId: string) => void;
}

function optionStatus(
  opt: QuestionOption,
  userKeys: readonly string[],
  correctKeys: readonly string[],
): 'correct' | 'wrong' | 'neutral' {
  if (correctKeys.includes(opt.key)) return 'correct';
  if (userKeys.includes(opt.key)) return 'wrong';
  return 'neutral';
}

function WrongHeader({
  questionNo,
  categoryLabel,
  userKeys,
  correctKeys,
  onAsk,
  questionId,
}: {
  readonly questionNo: number;
  readonly categoryLabel?: string;
  readonly userKeys: readonly string[];
  readonly correctKeys: readonly string[];
  readonly onAsk?: (questionId: string) => void;
  readonly questionId: string;
}) {
  const userText = userKeys.length === 0 ? '未作答' : userKeys.join(', ');
  const correctText = correctKeys.join(', ');
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <Badge tone="danger" variant="hairline">
        第 {questionNo} 题{categoryLabel !== undefined ? ` · ${categoryLabel}` : ''}
      </Badge>
      <span className="text-xs text-ink-3">
        你的答案：<b className="text-err">{userText}</b> · 正确答案：
        <b className="text-ok">{correctText}</b>
      </span>
      {onAsk !== undefined ? (
        <IconBtn
          size="sm"
          aria-label={`${LLM_QA_COPY.askButton} · 第 ${questionNo} 题`}
          onClick={() => onAsk(questionId)}
          data-testid={`wrong-review-ask-${questionId}`}
          className="ml-auto"
        >
          <ToolAiIcon size={16} />
        </IconBtn>
      ) : null}
    </div>
  );
}

export function WrongReviewCard({
  question,
  questionNo,
  userKeys,
  correctKeys,
  categoryLabel,
  anchorId,
  registerRef,
  onViewDetail,
  onAsk,
}: WrongReviewCardProps) {
  const stemHtml = { __html: DOMPurify.sanitize(question.content.stem ?? '') };
  const explanation = question.content.explanation ?? '';
  const options = question.content.options ?? [];
  const questionId = String(question.questionId);
  return (
    <article
      ref={registerRef}
      id={anchorId}
      // scroll-margin-top 给 sticky topbar (h-12 = 48px) 留位, 让
      // scrollIntoView({block:'start'}) 后题干不被 topbar 遮挡.
      className="bg-surface border border-line border-l-4 border-l-danger rounded-card px-4 py-4 scroll-mt-16"
      data-testid={`wrong-review-${question.questionId}`}
    >
      <WrongHeader
        questionNo={questionNo}
        categoryLabel={categoryLabel}
        userKeys={userKeys}
        correctKeys={correctKeys}
        onAsk={onAsk}
        questionId={questionId}
      />
      <div
        className="text-md font-medium leading-relaxed text-ink"
        dangerouslySetInnerHTML={stemHtml}
      />
      <div className="mt-3">
        {options.map((opt, idx) => (
          <OptionRow
            key={opt.key}
            optionKey={opt.key}
            text={<span>{opt.text}</span>}
            selected={userKeys.includes(opt.key)}
            status={optionStatus(opt, userKeys, correctKeys)}
            last={idx === options.length - 1}
            disabled
          />
        ))}
      </div>
      {explanation !== '' ? (
        <div className="mt-3 rounded-card bg-surface-alt border border-line px-4 py-4">
          <div className="text-tiny font-bold text-ink-3 mb-2">解析</div>
          <div
            className="font-mono text-sm leading-relaxed text-ink"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(explanation) }}
          />
          {onViewDetail !== undefined ? (
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onViewDetail(questionId)}
                data-testid={`wrong-review-detail-${questionId}`}
              >
                查看完整解析
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
