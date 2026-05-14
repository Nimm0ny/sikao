import type { ReactNode } from 'react';

// SIKAO Wave 2 Phase 3 — hifi 05b 申论结果 grade hero (Fixer D).
//
// 视觉 spec (design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2989-3000):
//   - eyebrow (mono 11px tracking-widest var(--ink-3))
//   - .grade horizontal grid (auto / 1fr, gap 36px, align-items: end)
//     - 左: .num 96px serif weight 500 + small "/100" mono 16px
//     - 右: .lbl mono 11px (e.g. "SCORE · 申论 · 比上次 +4.2")
//          h2 30px serif weight 500 (大标 "结构稳了, 扣分集中在...")
//          p  15px serif var(--ink-2) lh 1.7 (副标)
//   - 底部 1px solid var(--line-2) + margin-bottom 32px (collapse 到 view 端)
//
// 跟 ScoreHeader 对比: ScoreHeader 是 vertical stack (hero label / 大数字 /
// 大标 / 副标 / meta), 用于行测 res-shell. EssayResultHero 是 horizontal
// grid (num | meta block right) — layout 差异过大, 走 parallel implementation
// 不 wrap (master 拍板, 见 fixer brief).
//
// CJK 禁 italic — 标题 / 副标 / 题种全部 font-serif normal (CLAUDE.md §4).

export interface EssayResultHeroProps {
  /** 主分数 (e.g. 68.5) */
  readonly score: number;
  /** 满分 (e.g. 100). 必填 — 申论必带满分 (跟行测 100 默认不同). */
  readonly maxScore: number;
  /** 顶部 eyebrow (mono 11px). e.g. "Report · 申论 · 2026 国考模拟 #07" */
  readonly eyebrow?: string;
  /** lbl 行 mono 副标 (e.g. "SCORE · 申论 · 比上次 +4.2"). 可选 */
  readonly lbl?: string;
  /** 大标 (h2 serif). e.g. "结构稳了, 扣分集中在 '材料引用准确度'" */
  readonly headline: string;
  /** 副标 (p serif var(--ink-2) lh 1.7). 可选, 多行用 \n. */
  readonly subtitle?: string;
  /** 顶部右侧 actions slot (跟 eyebrow 同行右对齐). 可选 */
  readonly headerActions?: ReactNode;
  /** data-testid 前缀, 默认 'essay-result-hero' */
  readonly testIdPrefix?: string;
}

function formatScoreText(score: number): string {
  if (!Number.isFinite(score)) return '0.0';
  // 申论保留 1 位小数, 跟 hifi 68.5 / 跟 ScoreHeader 一致.
  return score.toFixed(1);
}

export function EssayResultHero({
  score,
  maxScore,
  eyebrow,
  lbl,
  headline,
  subtitle,
  headerActions,
  testIdPrefix = 'essay-result-hero',
}: EssayResultHeroProps) {
  return (
    <section
      data-testid={testIdPrefix}
      style={{
        paddingBottom: '28px',
        borderBottom: '1px solid var(--line-2)',
        marginBottom: '32px',
      }}
    >
      {/* eyebrow + 右上 actions 同行 (有 actions 才双段) */}
      {eyebrow !== undefined || headerActions !== undefined ? (
        <div
          className="flex items-start justify-between gap-4"
          style={{ marginBottom: '12px' }}
        >
          {eyebrow !== undefined ? (
            <div
              className="font-mono"
              style={{
                fontSize: 'var(--t-tiny)',
                letterSpacing: 'var(--tracking-widest)',
                color: 'var(--ink-3)',
              }}
              data-testid={`${testIdPrefix}-eyebrow`}
            >
              {eyebrow}
            </div>
          ) : (
            // 占位空 div 保 flex justify-between
            <div />
          )}
          {headerActions !== undefined ? (
            <div className="shrink-0" data-testid={`${testIdPrefix}-actions`}>
              {headerActions}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="grid items-end"
        style={{
          gridTemplateColumns: 'auto 1fr',
          gap: '36px',
        }}
      >
        {/* 左: 96px serif num + mono " / 100" */}
        <div
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
          {formatScoreText(score)}
          <small
            className="font-mono"
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'var(--ink-3)',
              marginLeft: '6px',
              letterSpacing: 'var(--tracking-loose)',
            }}
            data-testid={`${testIdPrefix}-max`}
          >
            {' / '}
            {maxScore}
          </small>
        </div>

        {/* 右: lbl + h2 + p */}
        <div>
          {lbl !== undefined ? (
            <div
              className="font-mono"
              style={{
                fontSize: '11px',
                letterSpacing: 'var(--tracking-widest)',
                color: 'var(--ink-3)',
                marginBottom: '8px',
              }}
              data-testid={`${testIdPrefix}-lbl`}
            >
              {lbl}
            </div>
          ) : null}
          <h2
            className="font-serif"
            style={{
              fontSize: '30px',
              fontWeight: 500,
              lineHeight: 'var(--lh-tight)',
              color: 'var(--ink-1)',
              margin: 0,
              letterSpacing: 'var(--tracking-tight)',
            }}
            data-testid={`${testIdPrefix}-headline`}
          >
            {headline}
          </h2>
          {subtitle !== undefined ? (
            <p
              className="font-serif"
              style={{
                fontSize: '15px',
                lineHeight: 1.7,
                color: 'var(--ink-2)',
                margin: '8px 0 0',
                whiteSpace: 'pre-wrap',
              }}
              data-testid={`${testIdPrefix}-subtitle`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
