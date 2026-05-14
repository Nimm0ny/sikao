/**
 * SIKAO Wave 4 Phase 2D · 智能复盘 5 mode 卡.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .sr-modes .mode SmartReview.
 *
 * 5 mode: 推荐 (亓菲线智能推送, 主线 — pri 暗底反白) / 单题 / 同类 / 抽考 / 险题.
 * 第 1 张 .mode.pri (ink bg + paper text) 是默认推荐入口.
 *
 * Dumb. 卡片点击触发 onSelectMode 回调, smart container 决策路由.
 */
import type { SmartReviewToday } from '@sikao/api-client/queries/wrongBookQueries';

export type SmartReviewMode = 'qifei' | 'single' | 'similar' | 'mock' | 'danger';

interface ModeDef {
  readonly key: SmartReviewMode;
  readonly num: string;
  readonly title: string;
  readonly description: string;
  readonly pri?: boolean;
  readonly badge?: string;
}

const MODES: readonly ModeDef[] = [
  {
    key: 'qifei',
    num: '01',
    title: '亓菲线智能推送',
    description:
      '基于遗忘曲线 + 错题反复次数 + 考前距离的复合模型。每天 10-20 题。',
    pri: true,
    badge: '主线',
  },
  {
    key: 'single',
    num: '02',
    title: '单题重做',
    description: '从错题列表挑一题,原题空白重答。蒙对检测开启,三次连对毕业。',
  },
  {
    key: 'similar',
    num: '03',
    title: '同类题练习',
    description:
      '围绕一个知识点抽 5 道变题。不重做原题,只练同模型——治"真空白"。',
  },
  {
    key: 'mock',
    num: '04',
    title: '错题抽考',
    description: '随机抽 20 道错题,限时模考。模拟真实考场压力下的错题再现率。',
  },
  {
    key: 'danger',
    num: '05',
    title: '险题专项',
    description: '只抽"险题/陷阱/蒙对"标签的题。这些是你真正不会的。',
  },
];

export interface SmartReviewModesProps {
  readonly today: SmartReviewToday;
  readonly onSelectMode: (mode: SmartReviewMode) => void;
}

export function SmartReviewModes({ today, onSelectMode }: SmartReviewModesProps) {
  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
      data-testid="smart-review-modes"
    >
      {MODES.map((m) => {
        const isPri = m.pri === true;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onSelectMode(m.key)}
            className={
              'border p-5 flex flex-col gap-3 text-left transition-colors duration-fast min-h-[200px] rounded-card ' +
              (isPri
                ? 'bg-ink text-white border-ink'
                : 'bg-surface text-ink border-line hover:border-line-3')
            }
            data-testid={`smart-review-mode-${m.key}`}
            aria-label={`选择复习模式：${m.title}`}
          >
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider">
              <span className={isPri ? 'text-white opacity-60' : 'text-ink-3'}>
                {m.num}
              </span>
              {m.badge != null ? (
                <span
                  className="font-mono text-xs uppercase tracking-wider bg-exam-accent text-white px-2 py-1 font-semibold"
                  data-testid={`smart-review-mode-${m.key}-badge`}
                >
                  {m.badge}
                </span>
              ) : null}
            </div>
            <h3 className="font-serif font-semibold text-h-card leading-tight m-0">
              {m.title}
            </h3>
            <p
              className={
                'text-xs leading-relaxed flex-1 m-0 ' +
                (isPri ? 'text-white opacity-70' : 'text-ink-3')
              }
            >
              {m.description}
            </p>
            {m.key === 'qifei' ? (
              <div className="flex gap-4 font-mono text-xs tabular-nums">
                <span>
                  待练{' '}
                  <b className="font-serif text-md font-semibold">
                    {Math.max(0, today.pushedToday - today.finishedToday)}
                  </b>
                </span>
                <span>
                  完成{' '}
                  <b className="font-serif text-md font-semibold">
                    {today.finishedToday}/{today.pushedToday}
                  </b>
                </span>
              </div>
            ) : null}
            <span className="inline-flex items-center font-mono text-xs uppercase tracking-wider font-medium">
              <span>开始 →</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
