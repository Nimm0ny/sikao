import { Button, Tooltip } from '@sikao/ui/ui';
import { ScoreHeader } from './ScoreHeader';

// SIKAO Wave 2 Phase 2 — 报告页 hero 区. 替代 Phase 4.3 的 brand-bg
// ScoreHero (深色面板里塞数据矩阵), 切到 hifi 05 paper-tint 风格:
//   - 顶部 eyebrow 写卷名 / 提交时间
//   - 用 ScoreHeader primitive 渲分数 + 大标 + 副标 + meta
//   - 右上 actions (导出 PDF + 逐题回顾) 走 ScoreHeader.headerActions slot
//   - 击败% bell 选用; 当前数据契约里 prevScoreDelta / defeatPercentile
//     还没接 BE, 跟 ScoreHero 一样: null 不渲染. 保 testid 跟 Result.test
//     一致 (result-header / hero-score-value / hero-meta-* / hero-bell-card
//     / result-continue-review / result-export-pdf), 避免回归.
//
// hifi 来源: design/SIKAO/handoff/modules/sikao-redesign/SIKAO Redesign.html
// line 2885-2900 + tokens line 1003-1018.

export interface ResultHeroProps {
  readonly paperName: string;
  readonly score: number;
  readonly maxScore?: number;
  readonly correctCount: number;
  readonly questionCount: number;
  /** ISO 8601 datetime string */
  readonly submittedAt?: string;
  /** Duration in seconds */
  readonly durationSeconds?: number;
  /** vs 上次同卷 score delta. null = 上次无记录 / BE 未提供, 不渲染. */
  readonly prevScoreDelta: number | null;
  /** 击败 % (0-100). null = 同卷样本 < 30, 不渲染. */
  readonly defeatPercentile: number | null;
  readonly onExportPdf?: () => void;
  /** 导出按钮 disabled 时的提示文案. 与 onExportPdf 互斥: 任一存在即渲染按钮. */
  readonly exportPdfDisabledHint?: string;
  readonly onContinueReview?: () => void;
}

function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${mo}.${day} ${h}:${mi}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface MetaItemProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'default' | 'success' | 'danger';
  readonly testId?: string;
}

function MetaItem({ label, value, tone = 'default', testId }: MetaItemProps) {
  // Hifi spec: ink-2 大字 mono 数值 + ink-3 mono caption.
  const valueClass =
    tone === 'success'
      ? 'text-ok'
      : tone === 'danger'
        ? 'text-err'
        : 'text-ink';
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 'var(--fs-eyebrow)',
          letterSpacing: 'var(--tracking-widest)',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span className={`font-mono text-base font-medium tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

interface ScoreBellProps {
  readonly defeatPercentile: number;
}

function ScoreBell({ defeatPercentile }: ScoreBellProps) {
  // 钟形 SVG: paper-tint 主题下用 ink token + 极淡 paper-deep 填充.
  // user marker 限制到分布主体范围 (60→400) 避免 0/100 边界把 marker 钉到曲线尾巴外缘.
  const userX = 60 + (defeatPercentile / 100) * 340;
  return (
    <svg
      viewBox="0 0 460 110"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label={`击败 ${defeatPercentile}% 同卷用户`}
    >
      <path
        d="M0,108 C 80,108 100,25 230,25 C 360,25 380,108 460,108 Z"
        fill="var(--paper-3)"
        stroke="var(--line-2)"
      />
      <line
        x1={userX}
        y1="0"
        x2={userX}
        y2="108"
        stroke="var(--ink-1)"
        strokeWidth="1.5"
      />
      <circle cx={userX} cy="35" r="5" fill="var(--ink-1)" />
    </svg>
  );
}

function pickHeadline(score: number): string {
  // 静态文案池 — backend 当前没 NLG 字段, 用分数段映射 4 句话.
  // 跟 hifi spec 调性 ("稳定段中游, 资料分析是关键") 一致.
  if (score >= 90) return '高分段稳健, 把节奏保住就好。';
  if (score >= 80) return '稳定段中游, 找一个掉链子的板块补上去。';
  if (score >= 70) return '已过及格线, 距高分段还差一两个模块。';
  if (score >= 60) return '基础在, 优先复盘最弱模块的方法论。';
  return '先稳住基础题节奏, 别陷在难题里。';
}

function pickSubtitle(
  score: number,
  prevScoreDelta: number | null,
  durationSeconds: number | undefined,
): string {
  const parts: string[] = [];
  if (prevScoreDelta !== null) {
    if (prevScoreDelta > 0) parts.push(`比上次 +${prevScoreDelta.toFixed(1)} 分`);
    else if (prevScoreDelta < 0) parts.push(`比上次 ${prevScoreDelta.toFixed(1)} 分`);
    else parts.push('跟上次持平');
  }
  if (durationSeconds !== undefined && Number.isFinite(durationSeconds)) {
    parts.push(`用时 ${formatDuration(durationSeconds)}`);
  }
  if (parts.length === 0) {
    if (score >= 80) return '下一步: 把弱项专项做掉, 再做一次完整模考。';
    return '下一步: 优先看错题里的高频题型。';
  }
  return parts.join(' · ') + '。下一步看错题, 把高频题型先扫一遍。';
}

interface HeroActionsProps {
  readonly onExportPdf?: () => void;
  readonly exportPdfDisabledHint?: string;
  readonly onContinueReview?: () => void;
}

function HeroActions({
  onExportPdf,
  exportPdfDisabledHint,
  onContinueReview,
}: HeroActionsProps) {
  const hasExport = onExportPdf !== undefined || exportPdfDisabledHint !== undefined;
  const hasContinue = onContinueReview !== undefined;
  if (!hasExport && !hasContinue) return null;
  return (
    <div className="flex items-center gap-2">
      {hasExport ? (
        exportPdfDisabledHint !== undefined ? (
          <Tooltip label={exportPdfDisabledHint}>
            <Button
              variant="ghost"
              size="sm"
              disabled
              data-testid="result-export-pdf"
            >
              导出 PDF
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportPdf}
            data-testid="result-export-pdf"
          >
            导出 PDF
          </Button>
        )
      ) : null}
      {hasContinue ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onContinueReview}
          data-testid="result-continue-review"
        >
          逐题回顾
        </Button>
      ) : null}
    </div>
  );
}

export function ResultHero({
  paperName,
  score,
  maxScore = 100,
  correctCount,
  questionCount,
  submittedAt,
  durationSeconds,
  prevScoreDelta,
  defeatPercentile,
  onExportPdf,
  exportPdfDisabledHint,
  onContinueReview,
}: ResultHeroProps) {
  const submittedText =
    submittedAt !== undefined ? `提交于 ${formatSubmittedAt(submittedAt)}` : null;
  // delta=0 是 "持平", 不能显绿色 (绿色暗示进步是数据误导). 三态: > 0
  // success / < 0 danger / === 0 default. 复用 ScoreHero 测试已固化的语义.
  const deltaText =
    prevScoreDelta === null
      ? null
      : prevScoreDelta === 0
        ? '持平'
        : prevScoreDelta > 0
          ? `+${prevScoreDelta.toFixed(1)}`
          : prevScoreDelta.toFixed(1);
  const deltaTone: 'success' | 'danger' | 'default' =
    prevScoreDelta === null || prevScoreDelta === 0
      ? 'default'
      : prevScoreDelta > 0
        ? 'success'
        : 'danger';

  const headline = pickHeadline(score);
  const subtitle = pickSubtitle(score, prevScoreDelta, durationSeconds);

  return (
    <section
      data-testid="result-header"
      className="border-b border-line pb-10"
    >
      {/* 顶部 eyebrow: "答题报告 · 卷名 · 提交时间", mono 11px tracking-widest.
          "答题报告" 锚词保 Result.test 文案断言不破; uppercase 仅作用 ASCII (CJK 无效). */}
      <div
        className="font-mono mb-3"
        style={{
          fontSize: 'var(--fs-eyebrow)',
          letterSpacing: 'var(--tracking-widest)',
          color: 'var(--ink-3)',
        }}
      >
        <span>答题报告</span>
        <span className="mx-2">·</span>
        <span>{paperName}</span>
        {submittedText !== null ? (
          <>
            <span className="mx-2">·</span>
            <span>{submittedText}</span>
          </>
        ) : null}
      </div>

      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] items-end">
        <ScoreHeader
          score={score}
          maxScore={maxScore}
          headline={headline}
          subtitle={subtitle}
          headerActions={
            <HeroActions
              onExportPdf={onExportPdf}
              exportPdfDisabledHint={exportPdfDisabledHint}
              onContinueReview={onContinueReview}
            />
          }
          meta={
            <div className="flex flex-wrap gap-x-6 gap-y-3" data-testid="hero-score-value">
              {durationSeconds !== undefined && Number.isFinite(durationSeconds) ? (
                <MetaItem
                  label="用时"
                  value={formatDuration(durationSeconds)}
                  testId="hero-meta-duration"
                />
              ) : null}
              <MetaItem
                label="正确"
                value={`${correctCount}/${questionCount}`}
                testId="hero-meta-correct"
              />
              {deltaText !== null ? (
                <MetaItem
                  label="vs 上次"
                  value={deltaText}
                  tone={deltaTone}
                  testId="hero-meta-delta"
                />
              ) : null}
            </div>
          }
        />

        {defeatPercentile !== null ? (
          <div
            className="rounded-card border border-line bg-paper-3 p-4"
            data-testid="hero-bell-card"
          >
            <div className="text-xs text-ink-3 mb-2">
              击败 <strong className="text-ink font-medium">{defeatPercentile}%</strong> 同卷用户
            </div>
            <div className="h-20">
              <ScoreBell defeatPercentile={defeatPercentile} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
