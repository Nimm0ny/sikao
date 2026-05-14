/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.ph-1920` 落地.
 *
 * 顶部 2 列 hero greeting: 左 eyebrow + h1 招呼 + sub guidance; 右 mono meta
 * + 本周计划 + 继续 CTA.
 *
 * data-testid="dashboard-hero" — Dashboard.test.tsx 现有断言保留入口.
 */

export interface HeroGreetingProps {
  /** mono uppercase eyebrow line — 日期 / 周次 / 距考时间. */
  readonly eyebrow: string;
  /** serif 大字招呼语 (e.g. "晚上好，林墨。"). */
  readonly greeting: string;
  /** body sub 文 — 上次停顿的考点 / 今日聚焦. */
  readonly sub: string;
  /** 右侧 mono meta (e.g. "TODAY · 03 / 05"). */
  readonly todayMeta: string;
  /** serif 已学时长 (e.g. "已学 1h 12min"). 缺值不显. */
  readonly learnedDuration?: string;
  /** 本周计划 secondary CTA. 缺则不显. */
  readonly onClickWeekPlan?: () => void;
  /** 继续主 CTA. 缺则不显. */
  readonly continueLabel?: string;
  readonly onClickContinue?: () => void;
}

export function HeroGreeting({
  eyebrow,
  greeting,
  sub,
  todayMeta,
  learnedDuration,
  onClickWeekPlan,
  continueLabel,
  onClickContinue,
}: HeroGreetingProps) {
  return (
    <header
      className="grid grid-cols-1 lg:grid-cols-[1fr_auto] items-end gap-6 lg:gap-8 pb-6 border-b border-line"
      data-testid="dashboard-hero"
    >
      <div>
        <div className="font-mono text-tiny tracking-widest uppercase text-ink-3">
          {eyebrow}
        </div>
        <h1 className="font-serif font-medium tracking-tight m-0 mt-2 text-h-mkt md:text-display leading-tight text-ink">
          {greeting}
        </h1>
        <p className="mt-3 text-sm text-ink-3 leading-relaxed max-w-2xl">
          {sub}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-right font-mono text-tiny tracking-widest text-ink-3 uppercase">
          {todayMeta}
          {learnedDuration != null ? (
            <>
              <br />
              <span className="font-serif text-sm text-ink tracking-normal normal-case">
                {learnedDuration}
              </span>
            </>
          ) : null}
        </div>
        {onClickWeekPlan != null ? (
          <button
            type="button"
            onClick={onClickWeekPlan}
            className="rounded-tiny bg-surface text-ink border border-ink px-4 py-3 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
            data-testid="dashboard-hero-week-plan"
          >
            本周计划
          </button>
        ) : null}
        {continueLabel != null && onClickContinue != null ? (
          <button
            type="button"
            onClick={onClickContinue}
            className="rounded-tiny bg-ink text-paper border border-transparent px-5 py-3 text-sm font-semibold hover:opacity-90 transition-opacity duration-fast"
            data-testid="dashboard-hero-continue"
          >
            {continueLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
