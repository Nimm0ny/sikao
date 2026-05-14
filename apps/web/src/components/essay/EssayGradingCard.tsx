import { useState } from 'react';
import { AlertCircleIcon, ChevronDownIcon } from '@sikao/ui/icons';
import { Card, ScoreRing } from '@sikao/ui/ui';
import { ESSAY_GRADING_COPY } from '@/lib/ui-copy';
import { cn } from '@sikao/shared-utils';
import { EssayDimensionsRadar } from './EssayDimensionsRadar';
import type { EssayFeedbackV2 } from '@sikao/api-client/types/api';

// Slice 2d — 申论批改报告主卡 (dumb, props-only).
//
// 组合: 顶部 suspicious banner (条件) + 总分 ScoreRing + 5 维度 radar + 5
// 维度明细 (name / score / weight / comment 每行一条). 三层信息密度递增,
// 用户从总览到细节自上而下读.
//
// suspicious=true 是 backend R10 sanity check 兜底标 (5 维全等差 ≤0.5 / sample
// 字数偏离 ±20%). 顶部 amber banner 让用户对结果心里有数. 不阻断展示 — 不
// 是 fail, 只是 hint.
//
// Phase 1A polish (SIKAO 05-result spec L32-34, L60-61):
//  1. weak 行 (得分率 < WEAK_THRESHOLD) 加 left-border + dot 指示器, 引导
//     注意力到弱项.
//  2. 默认 weak 展开 + 非 weak 折叠. 用 <details>/<summary> native disclosure
//     避免引入 framer-motion. summary 展示 name / score / weight 长可见,
//     body 展示 comment.

const WEAK_THRESHOLD = 0.6;

export interface EssayGradingCardProps {
  readonly feedback: EssayFeedbackV2;
  readonly className?: string;
}

export function EssayGradingCard({
  feedback,
  className,
}: EssayGradingCardProps) {
  const {
    overallScore,
    dimensions,
    suspicious,
  } = feedback;

  // dimensions 顺序固定 (论点/材料/语言/结构/字数), 用 index 作 expanded key.
  // weak set 在 mount 时 freeze, 后续 toggle 由 user-driven onToggle 维护.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const init = new Set<number>();
    dimensions.forEach((d, i) => {
      if (d.weight > 0 && d.score / (d.weight * 10) < WEAK_THRESHOLD) {
        init.add(i);
      }
    });
    return init;
  });

  const handleToggle = (i: number, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  return (
    <Card
      as="article"
      padding="lg"
      className={cn('flex flex-col gap-6', className)}
      data-testid="essay-grading-card"
    >
      {suspicious ? (
        <div
          role="alert"
          className="flex items-center gap-2 px-3 py-2 rounded-tiny bg-warn-bg border border-warn text-warn text-sm"
          data-testid="essay-grading-suspicious-banner"
        >
          <AlertCircleIcon className="w-4 h-4 shrink-0" />
          <span>{ESSAY_GRADING_COPY.suspiciousBanner}</span>
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="shrink-0 flex flex-col items-center">
          <ScoreRing
            value={overallScore}
            max={100}
            sublabel={ESSAY_GRADING_COPY.overallScoreLabel}
          />
        </div>
        <EssayDimensionsRadar
          dimensions={dimensions}
          className="flex-1"
        />
      </div>

      <ul
        className="flex flex-col gap-3 border-t border-line pt-5"
        data-testid="essay-grading-dimensions-list"
      >
        {dimensions.map((d, i) => {
          // weight 单位 0..1, score 0..10, 满分 = weight*10. 防 weight=0 除零.
          const maxScore = d.weight * 10;
          const isWeak = maxScore > 0 && d.score / maxScore < WEAK_THRESHOLD;
          const isOpen = expanded.has(i);
          const ariaLabel = `${d.name} ${ESSAY_GRADING_COPY.dimensionScoreFmt(d.score)}${
            isWeak ? ' 弱项' : ''
          }`;
          return (
            <li
              key={i}
              className="flex flex-col"
              data-testid={`essay-grading-dimension-${i}`}
              data-weak={isWeak ? 'true' : 'false'}
            >
              <details
                open={isOpen}
                onToggle={(e) =>
                  handleToggle(i, (e.currentTarget as HTMLDetailsElement).open)
                }
                className={cn(
                  'group flex flex-col gap-1',
                  isWeak && 'border-l-2 border-l-danger pl-3',
                )}
              >
                <summary
                  className="list-none cursor-pointer flex items-baseline justify-between gap-3 select-none [&::-webkit-details-marker]:hidden"
                  aria-label={ariaLabel}
                  data-testid={`essay-grading-dimension-summary-${i}`}
                >
                  <div className="flex items-baseline gap-2 min-w-0">
                    <ChevronDownIcon
                      size={14}
                      className={cn(
                        'shrink-0 text-ink-3 transition-transform duration-fast',
                        isOpen ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                    <h4
                      className={cn(
                        'text-md font-medium truncate',
                        isWeak ? 'text-err' : 'text-ink',
                      )}
                    >
                      {d.name}
                    </h4>
                    {isWeak ? (
                      <span
                        aria-hidden
                        data-pattern="dot"
                        data-testid={`essay-grading-dimension-weak-dot-${i}`}
                        className="ml-1 inline-block w-1.5 h-1.5 rounded-pill bg-err"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span
                      className={cn(
                        'font-serif text-xl italic font-normal tabular-nums',
                        isWeak ? 'text-err' : 'text-ink',
                      )}
                      data-testid={`essay-grading-dimension-score-${i}`}
                    >
                      {ESSAY_GRADING_COPY.dimensionScoreFmt(d.score)}
                    </span>
                    <span className="text-tiny font-mono tracking-loose text-ink-3">
                      {ESSAY_GRADING_COPY.dimensionWeightFmt(d.weight)}
                    </span>
                  </div>
                </summary>
                <p className="text-sm text-ink-3 leading-relaxed pt-1">
                  {d.comment}
                </p>
              </details>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
