/**
 * SIKAO Wave 4 Phase 2D · 错题卡 6-col grid 重构.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .row .sev .idx .body .metr .mast .act MainPage.
 *
 * 6 col: sev / idx / body / metr / mast / act
 *   - sev: 8px 左侧严重度色条 (high=exam-accent / mid=warn / low=ink-4 / ok=ok)
 *   - idx: 序号大字 (serif 30px)
 *   - body: pill (科目) + kp (知识点) + rep / danger / meek chip + q (题干 2 行 clamp) + why chip
 *   - metr: 你 / 正确 + 耗时 / 均时
 *   - mast: 3-dot 掌握度 + 已毕业 grad chip
 *   - act: 看 AI 解析 / 重做 / 加抽考 多个文字 link (mono uppercase)
 */
import type { KeyboardEvent, MouseEvent } from 'react';
import DOMPurify from 'dompurify';
import { Card, IconBtn } from '@sikao/ui/ui';
import { ToolAiIcon } from '@sikao/ui/icons';
import { LLM_QA_COPY, WRONG_BOOK_COPY } from '@/lib/ui-copy';
import type { MasteryLevel, WrongQuestionDetailV2 } from '@sikao/api-client/types/api';
import { cn } from '@sikao/shared-utils';

// 严重度映射 — 由 mastery + wrongCount derive (BE 暂无 sev 字段, FE 客户端聚合).
type Sev = 'high' | 'mid' | 'low' | 'ok';

function deriveSev(item: WrongQuestionDetailV2): Sev {
  if (item.masteryLevel === 'mastered') return 'ok';
  if (item.wrongCount >= 3) return 'high';
  if (item.wrongCount >= 2) return 'mid';
  return 'low';
}

const SEV_BG: Record<Sev, string> = {
  high: 'bg-exam-accent',
  mid: 'bg-warn',
  low: 'bg-ink-4',
  ok: 'bg-ok',
};

const MASTERY_DOTS: Record<MasteryLevel, number> = {
  not_mastered: 1,
  reviewing: 2,
  mastered: 3,
};

export interface WrongQuestionBatchMode {
  readonly inBatch: boolean;
  readonly onToggleBatch: (questionId: number) => void;
}

export interface WrongQuestionCardProps {
  readonly item: WrongQuestionDetailV2;
  readonly selected: boolean;
  readonly onSelect: (questionId: number) => void;
  readonly batch?: WrongQuestionBatchMode;
  /** PR10: "问 AI" callback. 点击 stopPropagation, 不触发外层 onSelect 跳详情. */
  readonly onAsk?: (questionId: number) => void;
}

export function WrongQuestionCard({
  item,
  selected,
  onSelect,
  batch,
  onAsk,
}: WrongQuestionCardProps) {
  const sev = deriveSev(item);
  const masteryDots = MASTERY_DOTS[item.masteryLevel];
  const isGraduated = item.masteryLevel === 'mastered';
  const userKeys = item.userLatestAnswerKeys.join('') || '-';
  const correctKeys = item.correctAnswerKeys.join('') || '-';
  const showCheckbox = batch !== undefined;
  const inBatch = batch?.inBatch ?? false;

  return (
    <Card
      as="article"
      padding="none"
      variant="default"
      className={cn(
        // SIKAO Wave 9 Phase 2b: mobile gap-4 + pr-4 收紧, tablet (md:) 跟 mobile
        // 同 3-col stack 不显示 metr/mast/act (lg:flex 才 reveal). desktop ≥1024
        // 拉回 gap-8 + pr-6 + 6-col grid (跟原版一致).
        'grid grid-cols-[8px_44px_1fr] md:grid-cols-[8px_56px_1fr] lg:grid-cols-[8px_56px_1fr_180px_140px_110px] gap-4 md:gap-6 lg:gap-8 items-center py-4 md:py-5 pr-4 md:pr-6 transition-colors duration-fast hover:bg-surface-alt cursor-pointer relative',
        selected && 'bg-surface-alt',
        inBatch && 'bg-paper-2',
      )}
      data-testid={`wrong-card-${item.questionId}`}
      onClick={() => onSelect(item.questionId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.questionId);
        }
      }}
      data-sev={sev}
      aria-label={`错题 ${item.questionId} · ${item.subject ?? ''} · 错 ${item.wrongCount} 次`}
    >
      {/* sev col 1 — 8px 颜色条 */}
      <div className={cn('self-stretch', SEV_BG[sev])} aria-hidden="true" />

      {/* idx col 2 — 序号大字. mobile 走 text-2xl (24px) 缩小 1 档防溢出, md+ 拉回 text-3xl. */}
      <div className="font-serif font-medium text-2xl md:text-3xl text-ink-4 text-center leading-none">
        {String(item.questionId).slice(-2).padStart(2, '0')}
      </div>

      {/* body col 3 — meta + 题干 + why chip */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {item.subject != null ? (
            <span className="font-mono text-xs uppercase tracking-wider border border-line px-2 py-1 text-ink-3">
              {item.subject}
            </span>
          ) : null}
          {item.subtype != null ? (
            <span className="font-mono text-xs text-ink-3 tracking-loose">
              {item.subtype}
            </span>
          ) : null}
          {item.wrongCount > 1 ? (
            <span className="font-mono text-xs uppercase tracking-wider bg-bad-bg text-err px-2 py-1 font-semibold">
              反复 {item.wrongCount} 次
            </span>
          ) : null}
          {sev === 'high' ? (
            <span className="font-mono text-xs uppercase tracking-wider bg-exam-accent text-white px-2 py-1 font-semibold">
              险题
            </span>
          ) : null}
          {showCheckbox ? (
            // a11y: native <label> 包 checkbox 是 a11y 标准 pattern; onClick={stopPropagation}
            // 阻止外层卡片 click 干扰勾选, label 自身仍把焦点/点击代理给 input.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <label
              className="ml-auto inline-flex items-center cursor-pointer"
              onClick={(e: MouseEvent) => e.stopPropagation()}
              data-testid={`wrong-card-batch-${item.questionId}`}
            >
              <input
                type="checkbox"
                className="w-4 h-4 accent-ink"
                checked={inBatch}
                onChange={() => batch?.onToggleBatch(item.questionId)}
                aria-label={`批量选中 第 ${item.questionId} 题`}
              />
            </label>
          ) : null}
        </div>
        <p
          className="font-serif text-md leading-snug text-ink line-clamp-2 m-0"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(item.stem, {
              ALLOWED_TAGS: [],
              ALLOWED_ATTR: [],
            }),
          }}
        />
      </div>

      {/* metr col 4 — 你 / 正确 + 耗时 */}
      <div className="hidden lg:flex flex-col gap-1">
        <div className="font-mono text-xs uppercase tracking-loose text-ink-3">
          你的 / 正确
        </div>
        <div className="flex gap-3 items-baseline">
          <span
            className={cn(
              'inline-block w-6 h-6 border text-center text-xs font-mono leading-6',
              isGraduated
                ? 'border-ok text-ok bg-ok-bg'
                : 'border-line text-ink-3',
            )}
            data-testid={`wrong-card-user-${item.questionId}`}
          >
            {userKeys}
          </span>
          <span className="inline-block w-6 h-6 border border-ok text-ok text-center text-xs font-mono leading-6 bg-ok-bg">
            {correctKeys}
          </span>
        </div>
      </div>

      {/* mast col 5 — 3-dot 掌握度 */}
      <div className="hidden lg:flex flex-col gap-1 font-mono text-xs text-ink-3 tracking-loose">
        {isGraduated ? (
          <span
            className="bg-ok-bg text-ok font-mono text-xs px-2 py-1 uppercase tracking-wider font-semibold w-fit"
            data-testid={`wrong-card-grad-${item.questionId}`}
          >
            已毕业
          </span>
        ) : (
          <>
            <div className="inline-flex gap-1 items-center" aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className={cn(
                    'w-1.5 h-1.5 rounded-pill border border-line-3',
                    k < masteryDots && 'bg-ink border-ink',
                  )}
                  data-pattern="dot"
                />
              ))}
            </div>
            <span>掌握度 {masteryDots}/3</span>
          </>
        )}
      </div>

      {/* act col 6 — 文字 link 操作 + PR10 问 AI IconBtn */}
      <div className="hidden lg:flex flex-col gap-2 items-end font-mono text-xs uppercase tracking-wider text-ink-3">
        <span
          className="hover:text-ink transition-colors duration-fast"
          aria-label="查看 AI 解析"
        >
          看解析 →
        </span>
        <span
          className="hover:text-ink transition-colors duration-fast"
          aria-label={WRONG_BOOK_COPY.cardRedoCta}
        >
          重做 →
        </span>
        {onAsk !== undefined ? (
          <IconBtn
            size="sm"
            aria-label={`${LLM_QA_COPY.askButton} · 第 ${item.questionId} 题`}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              onAsk(item.questionId);
            }}
            data-testid={`wrong-card-ask-${item.questionId}`}
          >
            <ToolAiIcon size={16} />
          </IconBtn>
        ) : null}
      </div>
    </Card>
  );
}
