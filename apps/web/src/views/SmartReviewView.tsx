/**
 * SIKAO Wave 4 Phase 2D · 智能复盘 view.
 *
 * spec: design/SIKAO/handoff/modules/xingce-wrongbook/xingce-wrongbook.html
 *       .sr-modes / .psh / .cal SmartReview.
 *
 * 路由: /wrong-book/smart-review.
 *
 * 主体: hero (4 stat-strip) + 5 mode 卡 + Flashcard + 日历 / 弱点 aside.
 *
 * 数据: useSmartReviewToday (4 stat) + useSmartReviewNext (单题推送).
 * Mode 卡 click: qifei 走 Flashcard 流; single → /wrong-book; similar → /categories;
 * mock → /practice/custom/start; danger → /wrong-book?view=danger.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Button,
} from '@sikao/ui/ui';
import {
  SmartReviewModes,
  type SmartReviewMode,
} from '@/components/wrong-book/SmartReviewModes';
import { Flashcard } from '@/components/wrong-book/Flashcard';
import {
  useSmartReviewNext,
  useSmartReviewToday,
  useSubmitWithBluff,
} from '@sikao/api-client/queries/wrongBookQueries';
import { cn } from '@sikao/shared-utils';

// 日历: 21 天 grid (3 周 × 7 天). 每天用 0-4 浓度. demo 数据 (生产侧 BE 出
// /smart-review/calendar 替换). 当前阶段只 visual; data 一致地来自 today 的 streakDays.
function deriveCalendar(streakDays: number): readonly number[] {
  // 21 天: 最近 streakDays 天高浓度, 前面递减.
  return Array.from({ length: 21 }).map((_, i) => {
    const daysAgo = 20 - i;
    if (daysAgo < streakDays && daysAgo >= 0) {
      return Math.min(4, Math.floor((streakDays - daysAgo) / 2) + 1);
    }
    return 0;
  });
}

export default function SmartReviewView() {
  const navigate = useNavigate();
  const todayQuery = useSmartReviewToday();
  const nextQuery = useSmartReviewNext();
  const submitMutation = useSubmitWithBluff();

  const [skippedIds, setSkippedIds] = useState<Set<number>>(() => new Set());

  const handleSelectMode = useCallback(
    (mode: SmartReviewMode) => {
      switch (mode) {
        case 'qifei':
          // 切换到 flashcard 流, mode 卡仍可见, 但 flashcard 区位置滚动.
          document
            .querySelector('[data-testid="smart-review-flashcard"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'single':
          navigate('/wrong-book');
          break;
        case 'similar':
          navigate('/categories');
          break;
        case 'mock':
          navigate('/practice/custom/start');
          break;
        case 'danger':
          navigate('/wrong-book?view=danger');
          break;
        default:
          break;
      }
    },
    [navigate],
  );

  const onSkip = useCallback(() => {
    if (nextQuery.data === undefined) return;
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.add(nextQuery.data.questionId);
      return next;
    });
    void nextQuery.refetch();
  }, [nextQuery]);

  const onSubmit = useCallback(() => {
    // 跳转到重做 view (DetailB 流). flashcard 这里只是 preview, 真做题去 DetailB.
    if (nextQuery.data === undefined) return;
    navigate(`/wrong-book/${nextQuery.data.questionId}/redo`);
  }, [nextQuery, navigate]);

  if (todayQuery.isLoading) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8 space-y-6">
        <Skeleton heightClass="h-24" />
        <Skeleton heightClass="h-72" />
      </div>
    );
  }

  if (todayQuery.isError) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8">
        <EmptyState
          title="加载失败"
          description="智能复盘数据加载失败, 请稍后重试."
          action={
            <Button variant="primary" onClick={() => void todayQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  const today = todayQuery.data;
  if (today === undefined) {
    return (
      <div className="px-4 md:px-14 py-6 md:py-8">
        <PageHeader title="智能复盘" subtitle="暂无数据" />
      </div>
    );
  }

  const calendar = deriveCalendar(today.streakDays);
  const remaining = Math.max(0, today.pushedToday - today.finishedToday);

  return (
    <div
      className="px-4 md:px-14 py-6 md:py-8 flex flex-col gap-6"
      data-testid="smart-review-view"
    >
      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 md:gap-8 items-end pb-6 md:pb-7 border-b border-line"
        data-testid="smart-review-hero"
      >
        <header>
          <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
            13 · Xingce / Smart Review
          </div>
          <h1 className="font-serif font-semibold text-h-mkt leading-tight tracking-tight text-ink mt-3 mb-0">
            智能复盘
            <br />
            <span className="text-ink-3 font-normal">
              五种模式,按你最弱的地方推
            </span>
          </h1>
          <p className="text-sm leading-relaxed text-ink-3 max-w-xl mt-3">
            基于遗忘曲线、错题反复次数、险题标签和考前距离,每天给你恰好的题量。
          </p>
        </header>
        {/* SIKAO Wave 9 Phase 2b: hero strip 3 档 responsive.
            mobile ≤768: 2-col grid (4 cell 占 2 行 2×2), gap-px + bg-line 分隔.
            tablet 769-1023: 单行 4-col grid 紧凑.
            desktop ≥1024: flex 单行, min-w-[114px] + border-l 分隔 (原版). */}
        <Card padding="none" variant="muted" className="overflow-hidden">
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line lg:flex lg:gap-0 lg:bg-transparent"
            data-testid="smart-review-hero-strip"
          >
            <div className="px-4 py-3 lg:px-5 lg:min-w-[114px] bg-surface-alt">
              <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
                今日推送
              </div>
              <div className="font-serif font-semibold text-h-card leading-tight text-ink mt-1 tabular-nums">
                {today.pushedToday}
                <span className="font-mono text-xs text-ink-3 ml-1 font-medium">
                  题
                </span>
              </div>
            </div>
            <div className="px-4 py-3 lg:px-5 lg:min-w-[114px] bg-surface lg:bg-surface-alt lg:border-l lg:border-line">
              <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
                已完成
              </div>
              <div className="font-serif font-semibold text-h-card leading-tight text-ink mt-1 tabular-nums">
                {today.finishedToday}
                <span className="font-mono text-xs text-ink-3 ml-1 font-medium">
                  / {today.pushedToday}
                </span>
              </div>
            </div>
            <div className="px-4 py-3 lg:px-5 lg:min-w-[114px] bg-surface lg:bg-surface-alt lg:border-l lg:border-line">
              <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
                连续
              </div>
              <div className="font-serif font-semibold text-h-card leading-tight text-ink mt-1 tabular-nums">
                {today.streakDays}
                <span className="font-mono text-xs text-ink-3 ml-1 font-medium">
                  天
                </span>
              </div>
            </div>
            <div className="px-4 py-3 lg:px-5 lg:min-w-[114px] bg-surface lg:bg-surface-alt lg:border-l lg:border-line">
              <div className="text-tiny font-mono tracking-eyebrow uppercase text-ink-4">
                距考
              </div>
              <div className="font-serif font-semibold text-h-card leading-tight text-ink mt-1 tabular-nums">
                {today.daysToExam}
                <span className="font-mono text-xs text-ink-3 ml-1 font-medium">
                  天
                </span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <SmartReviewModes today={today} onSelectMode={handleSelectMode} />

      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start"
        data-testid="smart-review-flashcard-row"
      >
        <Card padding="md" data-testid="smart-review-flashcard-main">
          <header className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-h-card font-semibold text-ink m-0">
              今日亓菲线推送 · {today.pushedToday} 题
            </h2>
            <span className="font-mono text-xs text-ink-3 tracking-loose">
              完成 {today.finishedToday} / {today.pushedToday} · 还剩 {remaining} 题
            </span>
          </header>

          {nextQuery.isLoading ? (
            <Skeleton heightClass="h-64" />
          ) : nextQuery.isError ||
            nextQuery.data === undefined ? (
            <div className="bg-surface-alt border border-dashed border-line px-6 py-10 text-center">
              <div className="font-serif text-md text-ink mb-2">
                暂无待练错题
              </div>
              <p className="text-sm text-ink-3">
                先去主页做几道题, 错题会自动进入复盘队列.
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={() => navigate('/wrong-book')}
                >
                  去错题本看看
                </Button>
              </div>
            </div>
          ) : (
            <Flashcard
              question={nextQuery.data}
              progress={{
                done: today.finishedToday + skippedIds.size,
                total: today.pushedToday,
              }}
              onSkip={onSkip}
              onSubmit={onSubmit}
              isSubmitting={submitMutation.isPending}
            />
          )}
        </Card>

        <aside className="space-y-4">
          <Card padding="md" data-testid="smart-review-calendar">
            <h3 className="font-serif text-md font-semibold m-0 mb-4">
              复习日历 · 近 21 天
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                <div
                  key={d}
                  className="font-mono text-xs text-ink-4 text-center tracking-loose py-1"
                >
                  {d}
                </div>
              ))}
              {calendar.map((c, i) => (
                <div
                  key={i}
                  className={cn(
                    'aspect-square border flex items-center justify-center font-mono text-xs',
                    c === 0 && 'bg-surface-alt border-transparent text-ink-3',
                    c === 1 && 'bg-paper-3 border-transparent text-ink',
                    c === 2 && 'bg-warn-bg border-transparent text-ink',
                    c === 3 && 'bg-warn border-transparent text-white',
                    c === 4 &&
                      'bg-exam-accent border-transparent text-white font-semibold',
                    i === 20 && 'outline outline-1 outline-ink',
                  )}
                  data-c={c}
                  data-testid={`smart-review-cal-day-${i}`}
                >
                  {c > 0 ? c : ''}
                </div>
              ))}
            </div>
          </Card>

          <Card
            padding="md"
            variant="muted"
            data-testid="smart-review-weak-points"
          >
            <h3 className="font-serif text-md font-semibold m-0 mb-3">
              下一题建议
            </h3>
            {nextQuery.data !== undefined ? (
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between py-2 border-b border-line">
                  <span className="text-ink-3">推荐模式</span>
                  <b className="font-serif text-sm text-ink">
                    {nextQuery.data.mode === 'qifei'
                      ? '亓菲线'
                      : nextQuery.data.mode === 'danger'
                        ? '险题'
                        : '常规'}
                  </b>
                </div>
                {nextQuery.data.knowledgePoint != null ? (
                  <div className="flex justify-between py-2 border-b border-line">
                    <span className="text-ink-3">知识点</span>
                    <b className="font-serif text-sm text-ink truncate max-w-[160px]">
                      {nextQuery.data.knowledgePoint}
                    </b>
                  </div>
                ) : null}
                <div className="flex justify-between py-2">
                  <span className="text-ink-3">连对</span>
                  <b className="font-serif text-sm text-ink">
                    {nextQuery.data.consecutiveCorrectCount} / 3
                  </b>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-3 leading-relaxed">
                等错题进来后, 这里会显示具体建议.
              </p>
            )}
          </Card>
        </aside>
      </section>
    </div>
  );
}
