/**
 * SIKAO Wave 4 Phase 2D · 错题本主页 Hero (5 stat strip).
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .ph + .pr + .stat-strip MainPage.
 *
 * 5 stat cell: 在练 / 待重做 / 险题 / 已毕业 / 本周新增. 第 1 个 cell 走
 * .accent (paper-2 底, 主语义着重). 数字走 serif 600 + tabular-nums.
 *
 * Dumb: 数据来自 useWrongBookSummary, smart container 拼.
 */
import { Card } from '@sikao/ui/ui';
import type { WrongBookSummary } from '@sikao/api-client/queries/wrongBookQueries';

export interface WrongBookHeroProps {
  readonly summary: WrongBookSummary;
}

interface Cell {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly accent?: boolean;
}

export function WrongBookHero({ summary }: WrongBookHeroProps) {
  const cells: readonly Cell[] = [
    {
      key: 'in-practice',
      label: '在练',
      value: summary.inPractice,
      unit: '题',
      accent: true,
    },
    { key: 'todo', label: '待重做', value: summary.todoCount, unit: '题' },
    { key: 'danger', label: '险题', value: summary.dangerCount, unit: '题' },
    {
      key: 'graduated',
      label: '已毕业',
      value: summary.graduatedCount,
      unit: '题',
    },
    {
      key: 'weekly-new',
      label: '本周',
      value: summary.weeklyNew,
      unit: '新增',
    },
  ];

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 md:gap-8 items-end pb-6 md:pb-7 border-b border-line"
      data-testid="wrong-book-hero"
    >
      <header>
        <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
          10 · Xingce / Wrongbook
        </div>
        <h1 className="font-serif font-semibold text-h-mkt leading-tight tracking-tight text-ink mt-3 mb-0">
          错题本
          <br />
          <span className="text-ink-3 font-normal">
            把每一处失分练成肌肉记忆
          </span>
        </h1>
        <p className="text-sm leading-relaxed text-ink-3 max-w-xl mt-3">
          行测五大模块的错题集中地——答错即进、蒙对也进、三次连对自动毕业。
        </p>
      </header>

      {/* SIKAO Wave 9 Phase 2b: stat strip 3 档 responsive.
          mobile ≤768: 2-col grid (5 cell 占 3 行: 2+2+1), gap-px + bg-line 父
            底色形成 1px 分隔.
          tablet 769-1023: 单行 5-col grid 同上 gap-px 分隔.
          desktop ≥1024: flex 单行, min-w-[114px] + border-l 分隔 (跟原版一致). */}
      <Card padding="none" variant="muted" className="overflow-hidden">
        <div
          className="grid grid-cols-2 md:grid-cols-5 gap-px bg-line lg:flex lg:gap-0 lg:bg-transparent"
          data-testid="wrong-book-hero-strip"
        >
          {cells.map((cell, idx) => (
            <div
              key={cell.key}
              className={
                'px-4 py-3 lg:px-5 lg:min-w-[114px] ' +
                'lg:border-l lg:border-line ' +
                (idx === 0 ? 'lg:border-l-0 ' : '') +
                (cell.accent === true
                  ? 'bg-surface-alt'
                  : 'bg-surface lg:bg-surface-alt')
              }
              data-testid={`wrong-book-hero-${cell.key}`}
            >
              <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
                {cell.label}
              </div>
              <div className="font-serif font-semibold text-h-card leading-tight text-ink mt-1 tabular-nums">
                {cell.value}
                <span className="font-mono text-xs text-ink-3 ml-1 font-medium">
                  {cell.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
