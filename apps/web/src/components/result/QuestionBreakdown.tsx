import { Fragment } from 'react';
import {
  classifyRubricTone,
  computeBarWidth,
  isWeakQuestion,
  splitTextWithHighlights,
  type QuestionBreakdownItem,
  type RubricItem,
} from './_essayResultHelpers';

// SIKAO Wave 2 Phase 3 — hifi 05b qbreak Q1-Q4 评分细项 (Fixer D).
//
// 视觉 spec (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2998-3018):
//   .qbreak (border-top var(--line-2))
//   .qrow grid 90px / 1fr / 140px (gap 24px, padding 22px 0,
//         border-bottom var(--line-2), align-items: start)
//   .qrow.weak background var(--accent-1) 4% (color-mix oklab) — 弱项行染色
//   .qkey (左列, 题号 + 题种)
//     .qnum (mono 11px tracking-widest var(--ink-3)) — Q1 / Q2 / Q3 / Q4
//     .qkind (serif 13px var(--ink-2) **CJK 不 italic**) — "归纳概括" 等
//   .qbody (中列, 题目 + rubric + 评论)
//     .qttl (serif 16px weight 500)
//     .rubric (flex wrap, 单条 mono 11px label + serif 14px score)
//     .rubric .ok b → var(--ok) ; .err b → var(--err)
//     .qcom (serif 14px lh 1.7 var(--ink-2)); mark 高亮关键词
//       (background var(--accent-50) + border-bottom var(--accent-1))
//   .qscore (右列右对齐, 32px serif 大分数 + bar + delta)
//
// 单 record 模式 caller (EssayGradingResult): 传 1 个 item, rubrics = 5 维度.
// 多 record 模式 caller (EssayExamResults): 传 N 个 item, 每条对应一题.
//
// 不复用 EssayGradingCard (那个是行测/老申论 v1 的 details 折叠 + radar 风格,
// hifi 05b 是 list 风格无 radar). 旧 component 在多 record 模式不变 (留给未来
// pull-to-refresh / detail panel 用).

export interface QuestionBreakdownProps {
  readonly items: readonly QuestionBreakdownItem[];
  readonly className?: string;
  /** data-testid 前缀, 默认 'qbreak' */
  readonly testIdPrefix?: string;
}

interface QrowProps {
  readonly item: QuestionBreakdownItem;
  readonly testIdPrefix: string;
}

function Qrow({ item, testIdPrefix }: QrowProps) {
  const weak = isWeakQuestion(item.score, item.maxScore);
  const barWidth = computeBarWidth(item.score, item.maxScore);

  // weak 行染色 (background var(--accent-1) 4%) + 跨左右负 margin (跟 hifi 一致).
  // 用 inline style 走 color-mix; 浏览器 fallback (不支持 oklab) 退化到 paper-2.
  const weakBg = weak
    ? {
        backgroundColor: 'color-mix(in oklab, var(--accent-1) 4%, transparent)',
        marginLeft: '-16px',
        marginRight: '-16px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }
    : {};

  return (
    <div
      className="grid items-start"
      style={{
        gridTemplateColumns: '90px 1fr 140px',
        columnGap: '24px',
        paddingTop: '22px',
        paddingBottom: '22px',
        borderBottom: '1px solid var(--line-2)',
        ...weakBg,
      }}
      data-testid={`${testIdPrefix}-row-${item.testIdSuffix}`}
      data-weak={weak ? 'true' : 'false'}
    >
      {/* 左: qkey (qnum + qkind) */}
      <div>
        <div
          className="font-mono uppercase"
          style={{
            fontSize: '11px',
            letterSpacing: 'var(--tracking-widest)',
            color: 'var(--ink-3)',
          }}
          data-testid={`${testIdPrefix}-qnum-${item.testIdSuffix}`}
        >
          {item.qnumLabel}
        </div>
        <div
          // CJK 禁 italic — hifi 原稿 .qkind { font-style: italic } 违反 §4.
          // 这里走 font-serif normal + 字号 13px 跟 hifi 字号一致.
          className="font-serif"
          style={{
            fontSize: '13px',
            fontStyle: 'normal',
            color: 'var(--ink-2)',
            marginTop: '4px',
            letterSpacing: 0,
          }}
          data-testid={`${testIdPrefix}-qkind-${item.testIdSuffix}`}
        >
          {item.qkindLabel}
        </div>
      </div>

      {/* 中: qbody (qttl + rubric + qcom) */}
      <div>
        <div
          className="font-serif"
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--ink-1)',
            marginBottom: '8px',
            lineHeight: 1.4,
          }}
          data-testid={`${testIdPrefix}-qttl-${item.testIdSuffix}`}
        >
          {item.qttl}
        </div>
        {item.rubrics.length > 0 ? (
          <RubricList
            rubrics={item.rubrics}
            testIdPrefix={`${testIdPrefix}-rubric-${item.testIdSuffix}`}
          />
        ) : null}
        {item.comment !== '' ? (
          <p
            className="font-serif"
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              margin: 0,
            }}
            data-testid={`${testIdPrefix}-qcom-${item.testIdSuffix}`}
          >
            {renderHighlightedText(
              item.comment,
              item.commentHighlights ?? [],
            )}
          </p>
        ) : null}
        {item.tailSlot !== undefined ? (
          <div
            className="mt-3"
            data-testid={`${testIdPrefix}-tail-${item.testIdSuffix}`}
          >
            {item.tailSlot}
          </div>
        ) : null}
      </div>

      {/* 右: qscore (大分数 + bar + delta) */}
      <div className="text-right">
        <div
          className="font-serif tabular-nums"
          style={{
            fontSize: '32px',
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--ink-1)',
          }}
          data-testid={`${testIdPrefix}-qn-${item.testIdSuffix}`}
        >
          {Number.isFinite(item.score) ? Math.round(item.score * 10) / 10 : 0}
          <small
            className="font-mono"
            style={{
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--ink-3)',
              letterSpacing: 'var(--tracking-loose)',
              marginLeft: '4px',
            }}
          >
            {' / '}
            {item.maxScore}
          </small>
        </div>
        <div
          className="relative"
          style={{
            height: '4px',
            backgroundColor: 'var(--line-2)',
            marginTop: '10px',
          }}
          role="progressbar"
          aria-valuenow={Math.round(barWidth)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${item.qnumLabel} 得分率 ${Math.round(barWidth)}%`}
        >
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: `${barWidth}%`,
              backgroundColor: weak ? 'var(--accent-1)' : 'var(--ink-1)',
            }}
          />
        </div>
        {item.deltaLabel !== undefined ? (
          <div
            className="font-mono"
            style={{
              fontSize: '11px',
              color:
                item.deltaTone === 'down'
                  ? 'var(--err)'
                  : item.deltaTone === 'up'
                    ? 'var(--ok)'
                    : 'var(--ink-3)',
              marginTop: '6px',
              letterSpacing: 'var(--tracking-loose)',
            }}
            data-testid={`${testIdPrefix}-delta-${item.testIdSuffix}`}
          >
            {item.deltaLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface RubricListProps {
  readonly rubrics: readonly RubricItem[];
  readonly testIdPrefix: string;
}

function RubricList({ rubrics, testIdPrefix }: RubricListProps) {
  return (
    <div
      className="flex flex-wrap font-mono"
      style={{
        columnGap: '16px',
        rowGap: '6px',
        fontSize: '11px',
        color: 'var(--ink-3)',
        letterSpacing: 'var(--tracking-loose)',
        marginBottom: '10px',
      }}
      data-testid={testIdPrefix}
    >
      {rubrics.map((r, i) => {
        const tone = classifyRubricTone(r.score, r.max);
        return (
          <span
            key={i}
            className="inline-flex items-baseline"
            style={{ gap: '4px' }}
            data-testid={`${testIdPrefix}-${i}`}
            data-tone={tone}
          >
            <span>{r.label}</span>
            <b
              className="font-serif tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color:
                  tone === 'ok'
                    ? 'var(--ok)'
                    : tone === 'err'
                      ? 'var(--err)'
                      : 'var(--ink-1)',
              }}
            >
              {Number.isFinite(r.score) ? Math.round(r.score * 10) / 10 : 0}
              {r.max > 0 ? ` / ${r.max}` : ''}
            </b>
          </span>
        );
      })}
    </div>
  );
}

function renderHighlightedText(text: string, highlights: readonly string[]) {
  const parts = splitTextWithHighlights(text, highlights);
  return parts.map((p, i) =>
    p.isMark ? (
      <mark
        key={i}
        style={{
          backgroundColor: 'var(--accent-50)',
          padding: '0 3px',
          borderBottom: '1px solid var(--accent-1)',
          color: 'var(--ink-1)',
        }}
      >
        {p.chunk}
      </mark>
    ) : (
      <Fragment key={i}>{p.chunk}</Fragment>
    ),
  );
}

export function QuestionBreakdown({
  items,
  className,
  testIdPrefix = 'qbreak',
}: QuestionBreakdownProps) {
  if (items.length === 0) return null;
  return (
    <div
      className={className}
      style={{
        borderTop: '1px solid var(--line-2)',
      }}
      data-testid={testIdPrefix}
    >
      {items.map((item) => (
        <Qrow
          key={item.testIdSuffix}
          item={item}
          testIdPrefix={testIdPrefix}
        />
      ))}
    </div>
  );
}
