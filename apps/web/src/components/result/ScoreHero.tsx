import { Button, Tooltip } from '@sikao/ui/ui';

// Phase 4.3 fenbi-merge — 替换 ResultHeader 的浅色 header 为深色 brand
// hero. 对齐 prototype 07 hero 区: 80px mono 大字总分 / 用时 / 正确率 /
// vs 上次 / 击败% 钟形分布. 击败% + vs 上次需 BE 数据 (distribution +
// prevScore), 当前不到位 → prop 为 null 时该 chip / meta 不渲染.

export interface ScoreHeroProps {
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
  /** 导出按钮 disabled 时的提示文案 (即将上线 / 等). 与 onExportPdf 互斥:
   * 任一存在即渲染按钮, 后者优先 (传 hint 时强制 disabled, title 显示该文案). */
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
  const valueClass =
    tone === 'success'
      ? 'text-ok'
      : tone === 'danger'
        ? 'text-err'
        : 'text-white';
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <span className="text-tiny font-semibold text-white/60 tracking-[0.04em]">{/* hardcode-allow: score number micro-adjust */}
        {label}
      </span>
      <span className={`font-mono text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

interface ScoreBellProps {
  readonly defeatPercentile: number;
}

function ScoreBell({ defeatPercentile }: ScoreBellProps) {
  // 钟形 SVG: 静态正态曲线 (path 主体 ~80→380). 用户 marker 限制到分布
  // 主体范围 (60→400) 而非整 viewBox 0→460, 避免 0/100 边界把 marker
  // 钉到曲线尾巴外缘 (review-fix #3).
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
        fill="color-mix(in oklch, var(--paper-1), transparent 94%)"
        stroke="color-mix(in oklch, var(--paper-1), transparent 85%)"
      />
      <line x1={userX} y1="0" x2={userX} y2="108" stroke="var(--paper-1)" strokeWidth="1.5" />
      <circle cx={userX} cy="35" r="5" fill="var(--paper-1)" />
    </svg>
  );
}

export function ScoreHero({
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
}: ScoreHeroProps) {
  const submittedText =
    submittedAt !== undefined ? `提交于 ${formatSubmittedAt(submittedAt)}` : null;
  // review-fix #2: delta=0 是"持平", 不能显绿色 (绿色暗示进步是数据误导).
  // 三态: > 0 success / < 0 danger / === 0 default (text-white)
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

  return (
    <div
      className="bg-ink-1 text-white rounded-card p-6 md:p-8"
      data-testid="result-header"
    >
      <div className="flex items-start justify-between gap-4 mb-4 md:mb-6">
        <div className="min-w-0">
          <div className="text-tiny font-bold text-white/60 tracking-loose">
            答题报告
          </div>
          <h2 className="text-lg md:text-xl font-semibold mt-1 truncate">
            {paperName}
          </h2>
          {submittedText !== null ? (
            <p className="text-xs text-white/60 mt-1">{submittedText}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onExportPdf !== undefined || exportPdfDisabledHint !== undefined ? (
            exportPdfDisabledHint !== undefined ? (
              <Tooltip label={exportPdfDisabledHint}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  className="!text-white hover:!bg-white/10"
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
                className="!text-white hover:!bg-white/10"
                data-testid="result-export-pdf"
              >
                导出 PDF
              </Button>
            )
          ) : null}
          {onContinueReview !== undefined ? (
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
      </div>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] items-center">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-6xl md:text-7xl font-semibold leading-none tabular-nums"
              data-testid="hero-score-value"
            >
              {score.toFixed(1)}
            </span>
            <span className="text-xl text-white/60 font-medium">/ {maxScore}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-6">
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
        </div>
        {defeatPercentile !== null ? (
          <div
            className="rounded-card border border-white/10 bg-white/5 p-4"
            data-testid="hero-bell-card"
          >
            <div className="text-xs text-white/70 mb-2">
              击败 <strong className="text-white font-semibold">{defeatPercentile}%</strong> 同卷用户
            </div>
            <div className="h-20">
              <ScoreBell defeatPercentile={defeatPercentile} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
