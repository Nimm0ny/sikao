import type { ReactNode } from 'react';

// SIKAO Wave 2 Phase 2 — 抽 hifi 05 报告页 score 区为通用 primitive.
// caller 决定是否套 Card / 加 paddings; 本 primitive 只负责"分数 + 大标 +
// 副标 + 自由 meta slot"的纵向 stack 排版.
//
// 视觉 spec (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2885-2983 + line 1008-1018):
//   - 顶部 mono eyebrow label (11px, tracking-widest=.14em uppercase, --ink-3)
//   - 大数字 96px serif weight 500 letter-spacing -0.02em
//   - maxScore mono 24px --ink-2 后缀 ("82.4 /100")
//   - h2 28px serif weight 500 lh 1.2
//   - p 14px sans --ink-2 lh 1.5
//   - meta region: 自由 ReactNode slot
//
// CJK 禁 italic (CLAUDE.md §4 italic 政策); 数字本身不带 italic
// (design hifi spec 也是无 italic 的纯 serif).

export interface ScoreHeaderProps {
  /** 主分数, e.g. 82.4 */
  readonly score: number;
  /** label 文案, e.g. "SCORE · OUT OF 100" / "得分", 可选 (有默认值) */
  readonly scoreLabel?: string;
  /** 满分, 用于 "82.4 / 100" 显示, 可选 (传入即渲染 mono 后缀) */
  readonly maxScore?: number;
  /** 大标题 (h2 serif) */
  readonly headline: string;
  /** 副标 (p sans), 可选 */
  readonly subtitle?: string;
  /** 灵活 meta 区 (用时 / 对标 / 趋势 etc), 可选 */
  readonly meta?: ReactNode;
  /** 顶部右上区域 (按钮 / actions slot), 可选; 跟 eyebrow 同行右对齐 */
  readonly headerActions?: ReactNode;
  /** data-testid 前缀, 默认 'score-header' */
  readonly testIdPrefix?: string;
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return '0.0';
  // 保留 1 位小数; design hifi 用 82.4, 跟现有 ScoreHero / ScoreModuleCard 一致.
  return score.toFixed(1);
}

export function ScoreHeader({
  score,
  scoreLabel = 'SCORE · OUT OF 100',
  maxScore,
  headline,
  subtitle,
  meta,
  headerActions,
  testIdPrefix = 'score-header',
}: ScoreHeaderProps) {
  return (
    <div className="flex flex-col gap-3" data-testid={testIdPrefix}>
      {/* eyebrow + 右上 actions 同行 (有 actions 才双段, 否则纯 eyebrow 行) */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 'var(--t-tiny)',
            letterSpacing: 'var(--tracking-widest)',
            color: 'var(--ink-3)',
          }}
          data-testid={`${testIdPrefix}-label`}
        >
          {scoreLabel}
        </div>
        {headerActions !== undefined ? (
          <div className="shrink-0" data-testid={`${testIdPrefix}-actions`}>
            {headerActions}
          </div>
        ) : null}
      </div>

      {/* 大数字 + maxScore 后缀 (baseline 对齐) */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="font-serif tabular-nums"
          style={{
            fontSize: '96px',
            fontWeight: 500,
            lineHeight: 0.9,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--ink-1)',
          }}
          data-testid={`${testIdPrefix}-score`}
        >
          {formatScore(score)}
        </span>
        {maxScore !== undefined ? (
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: '24px',
              color: 'var(--ink-2)',
              letterSpacing: 'var(--tracking-loose)',
            }}
            data-testid={`${testIdPrefix}-max`}
          >
            /{maxScore}
          </span>
        ) : null}
      </div>

      {/* h2 大标 */}
      <h2
        className="font-serif"
        style={{
          fontSize: '28px',
          fontWeight: 500,
          lineHeight: 'var(--lh-tight)',
          color: 'var(--ink-1)',
          margin: 0,
        }}
        data-testid={`${testIdPrefix}-headline`}
      >
        {headline}
      </h2>

      {/* 副标 (可选) */}
      {subtitle !== undefined ? (
        <p
          className="font-sans"
          style={{
            fontSize: '14px',
            lineHeight: 'var(--lh-normal)',
            color: 'var(--ink-2)',
            margin: 0,
            maxWidth: '420px',
          }}
          data-testid={`${testIdPrefix}-subtitle`}
        >
          {subtitle}
        </p>
      ) : null}

      {/* meta slot (可选, 任意 ReactNode) */}
      {meta !== undefined ? (
        <div className="mt-2" data-testid={`${testIdPrefix}-meta`}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}
