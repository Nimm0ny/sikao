/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — row-mid 占位卡.
 *
 * 当对应 query 缺数据 / 暂未触达条件时, 用本占位卡替代 (e.g. heatmap 不足 7 天
 * 替代 WeekRhythmCard; studyPlan 缺时替代 PlanTasksCard). 走 SIKAO card 调性,
 * 跟实际卡视觉等价, 不破 grid 比例.
 */

export interface PlaceholderCardProps {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel?: string;
  readonly onCta?: () => void;
  readonly testId?: string;
  readonly ctaTestId?: string;
}

export function PlaceholderCard({
  title,
  body,
  ctaLabel,
  onCta,
  testId,
  ctaTestId,
}: PlaceholderCardProps) {
  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card"
      data-testid={testId}
    >
      <h4 className="font-serif text-lg font-medium m-0 pb-3 border-b border-line">
        {title}
      </h4>
      <p className="text-sm text-ink-3 leading-relaxed">{body}</p>
      {ctaLabel != null && onCta != null ? (
        <button
          type="button"
          onClick={onCta}
          className="self-start rounded-tiny bg-surface text-ink border border-ink px-3 py-2 text-sm font-medium hover:bg-ink hover:text-white transition-colors duration-fast"
          data-testid={ctaTestId}
        >
          {ctaLabel}
        </button>
      ) : null}
    </section>
  );
}
