import type { CSSProperties, ReactNode } from 'react';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.today-1920` 落地.
 *
 * Ink-first focus card. 黑底白字, 右上角放射状 accent 蓝渐变, 标题 serif,
 * "今天先想清楚" 引导 + 4 项 metric strip + 3 操作.
 *
 * Dumb (frontend/CLAUDE.md §2.2): 仅渲染. caller 装数据 + handlers.
 *
 * TODO(2026-05-11 lhr): 焦点考点 / 标题 / 引导文案目前是 mock — 后端无对应
 * /dashboard/focus endpoint. 后续 BE 接 LLM 推荐时此组件 props 不变, 由 caller
 * 切真实数据源. 4 项 metric 已走 summary 真实字段.
 */

export interface FocusCardMetric {
  readonly label: string;
  /** 真实数值. 缺值时显 "—". */
  readonly value: string;
}

export interface FocusCardProps {
  /** 上方 mono uppercase eyebrow. 例 "FOCUS · 资料分析 / 增长率与基期". */
  readonly eyebrow: string;
  /** serif 大标题. JSX 允许换行 (<br/>). */
  readonly title: ReactNode;
  /** body 引导文. */
  readonly body: string;
  /** 4 项 metric strip. exactly 4 (hifi 设计稿固定). */
  readonly metrics: readonly [FocusCardMetric, FocusCardMetric, FocusCardMetric, FocusCardMetric];
  /** 主 CTA 文案 (例 "看 3 分钟思路图"). */
  readonly primaryLabel: string;
  readonly onPrimary: () => void;
  /** 次 CTA 文案 (例 "直接做题"). 可选. */
  readonly secondaryLabel?: string;
  readonly onSecondary?: () => void;
  /** Ghost 跳过文案 (例 "跳过 · 改换专题"). 可选. */
  readonly ghostLabel?: string;
  readonly onGhost?: () => void;
}

// hifi spec: `.today-1920::after` 右上角放射 accent 渐变.
const HALO_STYLE: CSSProperties = {
  content: '""',
  position: 'absolute',
  right: '-10%',
  top: '-30%',
  width: '50%',
  aspectRatio: '1',
  background:
    'radial-gradient(circle, var(--accent-1), transparent 60%)',
  opacity: 0.35,
  pointerEvents: 'none',
};

export function FocusCard({
  eyebrow,
  title,
  body,
  metrics,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  ghostLabel,
  onGhost,
}: FocusCardProps) {
  return (
    <section
      // hifi `.today-1920`: bg-ink + text-paper, p 40 44, gap-24 (col),
      // overflow-hidden 让 ::after halo 不溢出.
      className="relative overflow-hidden rounded-card-lg bg-ink text-paper p-8 md:p-10 flex flex-col gap-6"
      style={{ ['--accent' as string]: 'var(--accent-1)' }}
      data-testid="dashboard-focus-card"
    >
      {/* halo: 走 absolute span 替代 ::after pseudo, RSC 友好 + class lint 不报. */}
      <span aria-hidden="true" style={HALO_STYLE} />

      <div
        className="relative z-10 font-mono text-tiny tracking-widest uppercase"
        style={{ color: 'color-mix(in oklch, var(--paper-1), transparent 45%)' }}
      >
        {eyebrow}
      </div>
      <h2
        className="relative z-10 font-serif text-h-section md:text-h-mkt leading-tight m-0"
        // CJK 不能 italic; SIKAO 大标题保留 serif + leading-tight, letter
        // tighten 走 fontSize letterSpacing token (h-section / h-mkt 内置).
      >
        {title}
      </h2>
      <p
        className="relative z-10 text-base leading-relaxed max-w-prose"
        style={{ color: 'color-mix(in oklch, var(--paper-1), transparent 28%)' }}
      >
        {body}
      </p>

      {/* metric strip: 4 列 grid + 内描边. inset border 走 paper-1 token + color-mix
          88% transparent (= rgba 12% 等价), 跟 hifi 设计稿 "rgba(255,255,255,.12)"
          隐线意图一致 + dark mode 自动 follow paper 反相 (paper-1 dark=#15130F). */}
      <div
        className="relative z-10 grid grid-cols-4"
        style={{
          borderTop: '1px solid color-mix(in oklch, var(--paper-1), transparent 88%)',
          borderLeft: '1px solid color-mix(in oklch, var(--paper-1), transparent 88%)',
        }}
        data-testid="dashboard-focus-strip"
      >
        {metrics.map((m, idx) => (
          <div
            key={`${m.label}-${idx}`}
            className="px-4 py-4 md:px-5"
            style={{
              borderRight: '1px solid color-mix(in oklch, var(--paper-1), transparent 88%)',
              borderBottom: '1px solid color-mix(in oklch, var(--paper-1), transparent 88%)',
            }}
          >
            <div className="font-mono text-3xl font-medium leading-none">
              {m.value}
            </div>
            <div
              className="mt-2 font-mono text-tiny tracking-eyebrow uppercase"
              style={{ color: 'color-mix(in oklch, var(--paper-1), transparent 40%)' }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-tiny bg-paper text-ink px-5 py-3 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
          data-testid="dashboard-focus-primary"
        >
          {primaryLabel}
        </button>
        {secondaryLabel != null && onSecondary != null ? (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-tiny bg-transparent text-paper px-5 py-3 text-sm font-medium border hover:bg-white/10 transition-colors duration-fast"
            style={{ borderColor: 'color-mix(in oklch, var(--paper-1), transparent 60%)' }}
            data-testid="dashboard-focus-secondary"
          >
            {secondaryLabel}
          </button>
        ) : null}
        {ghostLabel != null && onGhost != null ? (
          <button
            type="button"
            onClick={onGhost}
            className="text-sm font-medium hover:text-paper transition-colors duration-fast"
            style={{ color: 'color-mix(in oklch, var(--paper-1), transparent 45%)' }}
            data-testid="dashboard-focus-ghost"
          >
            {ghostLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
