// SIKAO Wave 4 — pending hero block for EssayExamResults.
//
// 整卷模考 weighted.value === null (paper.questions 没拉到 / 全 pending)
// 时渲染的 hero 占位. 跟正常 <EssayResultHero> 视觉对齐 (96px serif 数字),
// 只是分数处显 "—" 不显数字. 抽出原因: EssayExamResults.tsx 触 §3.5 单
// 文件 500 行硬约束, 此 block 90 行 inline JSX 是大头.
//
// design source: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// hifi 05b paper-tint, pending eyebrow + 96px serif "—" + headline/subtitle.

export interface EssayExamHeroPendingProps {
  readonly eyebrow: string;
  readonly lbl: string;
  readonly headline: string;
  readonly subtitle: string;
}

export function EssayExamHeroPending({
  eyebrow,
  lbl,
  headline,
  subtitle,
}: EssayExamHeroPendingProps) {
  return (
    <section
      data-testid="essay-result-hero"
      style={{
        paddingBottom: '28px',
        borderBottom: '1px solid var(--line-2)',
        marginBottom: '32px',
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 'var(--t-tiny)',
          letterSpacing: 'var(--tracking-widest)',
          color: 'var(--ink-3)',
          marginBottom: '12px',
        }}
      >
        {eyebrow}
      </div>
      <div
        className="grid items-end"
        style={{ gridTemplateColumns: 'auto 1fr', gap: '36px' }}
      >
        <div
          className="font-serif tabular-nums"
          style={{
            fontSize: '96px',
            fontWeight: 500,
            lineHeight: 0.9,
            color: 'var(--ink-3)',
          }}
          data-testid="essay-exam-results-weighted-pending"
        >
          —
          <small
            className="font-mono"
            style={{
              fontSize: '16px',
              color: 'var(--ink-3)',
              marginLeft: '6px',
              letterSpacing: 'var(--tracking-loose)',
            }}
          >
            {' / 100'}
          </small>
        </div>
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: '11px',
              letterSpacing: 'var(--tracking-widest)',
              color: 'var(--ink-3)',
              marginBottom: '8px',
            }}
            data-testid="essay-exam-results-progress"
          >
            {lbl}
          </div>
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
          >
            {headline}
          </h2>
          <p
            className="font-serif"
            style={{
              fontSize: '15px',
              lineHeight: 1.7,
              color: 'var(--ink-2)',
              margin: '8px 0 0',
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  );
}
