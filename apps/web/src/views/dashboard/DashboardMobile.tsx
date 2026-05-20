import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExamCustomSheet, type ExamFormInput } from '@/components/dashboard';
import {
  useContinueLastSession,
  useCreateUserExam,
  useDeleteUserExam,
  useTodayStudyPlan,
  useUpcomingExams,
  useWeakModules,
  type PracticeSessionSummary,
  type WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import { useAuthStore } from '@sikao/domain/auth/useAuthStore';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

/**
 *
 * SSOT: docs/design/Mobile and Tablet Pack New.html "M1 · Home" 原型
 *
 * 复用 Dashboard.tsx 同款 hooks (useContinueLastSession / useTodayStudyPlan /
 * useUpcomingExams / useWeakModules + useCreateUserExam / useDeleteUserExam),
 * 不重写数据流 — 只换 layout (mobile-first M1 风格替代 desktop 4-block grid).
 *
 *   1. 黑卡「继续上次」占顶 1/3 (.m-card-elev)
 *   2. 3 列 mstat (本周 / 正确率 / 打卡)
 *   3. 今日计划 list (.m-list-row × N)
 *
 * 跟 desktop 4-block 区别: 第 3 块"临考冲刺"在 M1 简化为 hero greeting strip
 * (距 N 天) 不另起 block; 第 4 块"薄弱模块"在 M1 不显, 由用户从 TabBar 进入
 * 跳独立 page).
 *
 * Italic 政策 (CLAUDE.md §4): CJK 禁 italic. mstat__label / __unit / __delta
 * 走 var(--font-serif) + ink-3 不带 italic; 原型 italic 仅是装饰, 在 mobile.css
 * 已改成 font-weight 400 + tracking. 数字 mstat__value 是 serif 大数字
 * (D2c 例外) 但本视图不用 italic.
 */

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function getInitialChar(name: string): string {
  return name.trim().slice(0, 1) || '同';
}

function hourGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return '深夜好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const SUBJECT_TO_PATH: Record<WeakModule['subject'], string> = {
  言语: '/xingce/specialty#言语',
  数量: '/xingce/specialty#数量',
  判推: '/xingce/specialty#判推',
  资分: '/xingce/specialty#资分',
  常识: '/xingce/specialty#常识',
};

export function DashboardMobile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const displayName = user?.displayName ?? user?.username ?? '同学';

  const continueQ = useContinueLastSession();
  const planQ = useTodayStudyPlan();
  const examsQ = useUpcomingExams();
  const weakQ = useWeakModules({ limit: 1 });

  const lastSession = continueQ.data ?? null;
  const plan = planQ.data ?? null;
  // useMemo 锁定 exams ref — 否则 ?? [] 每次 render 出新 array, 触发 useMemo
  // (headSub) deps 反复改变 (react-hooks/exhaustive-deps warning).
  const exams = useMemo(() => examsQ.data?.exams ?? [], [examsQ.data]);
  const weakModules = weakQ.data?.modules ?? [];

  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  const now = useMemo(() => new Date(), []);
  const greeting = `${hourGreeting(now)}，${displayName}`;

  // Header sub: 最近 exam 倒计时 OR weekday fallback (clean greeting bar).
  const headSub = useMemo(() => {
    if (exams.length > 0) {
      const next = exams[0];
      const days = next.daysUntil ?? null;
      if (days !== null && days >= 0) return `距 ${next.name} ${days} 天`;
    }
    return WEEKDAY_LABELS[now.getDay()] ?? '';
  }, [exams, now]);

  const handleContinue = useCallback(
    (session: PracticeSessionSummary) => {
      navigate(`/practice/sessions/${session.id}`);
    },
    [navigate],
  );

  const handleStartNew = useCallback(() => {
    navigate('/practice/center');
  }, [navigate]);

  const handleGoToPlan = useCallback(() => navigate('/plan'), [navigate]);

  const handleOpenSheet = useCallback(() => setSheetOpen(true), []);
  const handleCloseSheet = useCallback(() => setSheetOpen(false), []);

  const createExamMut = useCreateUserExam();
  const deleteExamMut = useDeleteUserExam();

  const handleCreateExam = useCallback(
    (input: ExamFormInput) => {
      createExamMut.mutate(
        { name: input.name, examDate: input.examDate, notes: input.notes },
        {
          onError: (err) => {
            logger.error('[dashboard-mobile] create exam failed', { err: String(err) });
            toast.error('保存失败', DASHBOARD_COPY.retryHint);
          },
        },
      );
    },
    [createExamMut],
  );

  const handleDeleteExam = useCallback(
    (examId: number) => {
      deleteExamMut.mutate(examId, {
        onError: (err) => {
          logger.error('[dashboard-mobile] delete exam failed', {
            err: String(err),
            examId,
          });
          toast.error('删除失败', DASHBOARD_COPY.retryHint);
        },
      });
    },
    [deleteExamMut],
  );

  const handlePracticeWeak = useCallback(
    (subject: WeakModule['subject']) => navigate(SUBJECT_TO_PATH[subject]),
    [navigate],
  );

  // Block 1: continue card (M1 黑卡)
  const renderContinueCard = () => {
    if (lastSession == null) {
      return (
        <section
          className="m-card-elev"
          data-testid="dashboard-mobile-continue-empty"
        >
          <div className="m-card-elev__head">{DASHBOARD_COPY.mobileStartEyebrow}</div>
          <p className="m-card-elev__title">
            {DASHBOARD_COPY.mobileStartEmpty}
          </p>
          <div className="m-card-elev__cta-row">
            <button
              type="button"
              className="m-btn-pill"
              onClick={handleStartNew}
              data-testid="dashboard-mobile-start-new"
            >
              开始练习
            </button>
            <button
              type="button"
              className="m-btn-pill m-btn-pill--ghost"
              onClick={handleOpenSheet}
              data-testid="dashboard-mobile-add-exam"
            >
              设目标
            </button>
          </div>
        </section>
      );
    }
    const answered = lastSession.answeredCount ?? 0;
    const total = lastSession.total ?? 0;
    return (
      <section
        className="m-card-elev"
        data-testid="dashboard-mobile-continue"
      >
        <div className="m-card-elev__head">上次停在</div>
        <h2 className="m-card-elev__title">
          {lastSession.paperTitle}
          <br />
          已练 {answered} / {total} 题
        </h2>
        <div className="m-card-elev__cta-row">
          <button
            type="button"
            className="m-btn-pill"
            onClick={() => handleContinue(lastSession)}
            data-testid="dashboard-mobile-resume"
          >
            继续
          </button>
          {weakModules.length > 0 ? (
            <button
              type="button"
              className="m-btn-pill m-btn-pill--ghost"
              onClick={() => handlePracticeWeak(weakModules[0].subject)}
              data-testid="dashboard-mobile-practice-weak"
            >
              练{weakModules[0].subject}
            </button>
          ) : null}
        </div>
      </section>
    );
  };

  // Block 2: mstat row (本周 / 正确率 / 打卡)
  // 数据来源 — plan.dailyQuota / weekly stats currently 不一一暴露 in BE schema;
  // MVP 走 plan.tasks 完成度 + lastSession.answeredCount fallback 0.
  const planDone = plan?.tasks.filter((t) => t.status === 'completed').length ?? 0;
  const weeklyAnswered = lastSession?.answeredCount ?? planDone * 10;
  const accuracyPct =
    plan?.dailyAccuracyTarget != null
      ? Math.round(plan.dailyAccuracyTarget * 100)
      : 0;
  const streakDays = exams.length > 0 ? exams.length : planDone;

  // Block 3: today plan list (最多 3 条 task)
  const visibleTasks = plan?.tasks.slice(0, 3) ?? [];

  return (
    <div
      className="m-pbody min-h-full"
      data-testid="dashboard-mobile-view"
    >
      {/* hero greeting strip — Avatar + name + countdown sub */}
      <header className="m-app-head" data-testid="dashboard-mobile-hero">
        <div className="m-app-head__left">
          <div
            className="m-app-head__avatar"
            aria-label={`${displayName} 头像`}
          >
            {getInitialChar(displayName)}
          </div>
          <div className="min-w-0">
            <h1 className="m-app-head__title truncate">{greeting}</h1>
            {headSub.length > 0 ? (
              <p className="m-app-head__sub truncate">{headSub}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="m-app-head__icon-btn"
          aria-label={DASHBOARD_COPY.mobileEditExamAria}
          onClick={handleOpenSheet}
          data-testid="dashboard-mobile-edit-exam"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14 4l6 6-9 9H5v-6z" />
            <path d="M13 5l6 6" />
          </svg>
        </button>
      </header>

      {renderContinueCard()}

      <section
        className="mstat-row"
        data-testid="dashboard-mobile-mstat"
        aria-label={DASHBOARD_COPY.mobileWeekOverviewAria}
      >
        <div className="mstat">
          <div className="mstat__label">本周</div>
          <div className="mstat__value">
            {weeklyAnswered}
            <span className="mstat__unit">题</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">—</div>
        </div>
        <div className="mstat">
          <div className="mstat__label">正确率</div>
          <div className="mstat__value">
            {accuracyPct > 0 ? accuracyPct : 0}
            <span className="mstat__unit">%</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">
            {accuracyPct > 0 ? '目标' : '—'}
          </div>
        </div>
        <div className="mstat">
          <div className="mstat__label">打卡</div>
          <div className="mstat__value">
            {streakDays}
            <span className="mstat__unit">天</span>
          </div>
          <div className="mstat__delta mstat__delta--flat">—</div>
        </div>
      </section>

      <div className="m-section-head" data-testid="dashboard-mobile-plan-head">
        <h2>今日计划</h2>
        <button
          type="button"
          className="m-section-head__more bg-transparent border-none cursor-pointer"
          onClick={handleGoToPlan}
        >
          全部 →
        </button>
      </div>

      {visibleTasks.length === 0 ? (
        <section
          className="m-card"
          data-testid="dashboard-mobile-plan-empty"
        >
          <p className="text-sm text-ink-3 m-0">
            {DASHBOARD_COPY.todayPlanEmpty}。{DASHBOARD_COPY.mobileTodayEmptyHint}。
          </p>
        </section>
      ) : (
        <section
          className="m-card"
          style={{ padding: '8px 14px' }}
          data-testid="dashboard-mobile-plan-list"
        >
          {visibleTasks.map((task) => {
            const isDone = task.status === 'completed';
            return (
              <button
                key={task.id}
                type="button"
                className="m-list-row"
                onClick={handleGoToPlan}
                data-testid={`dashboard-mobile-task-${task.id}`}
              >
                <div className="min-w-0">
                  <div
                    className={`m-list-row__title truncate ${
                      isDone ? 'line-through text-ink-3' : ''
                    }`}
                  >
                    {task.payload.title}
                  </div>
                  <div className="m-list-row__meta">
                    {isDone ? '已完成' : '待做'}
                  </div>
                </div>
                <span
                  className={`m-list-row__right ${
                    isDone ? 'm-list-row__right--ok' : ''
                  }`}
                >
                  {isDone ? '✓' : '→'}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {/* Weak modules quick link (M1 简版: 1 行 list-row, 不堆完整 dataset) */}
      {weakModules.length > 0 ? (
        <>
          <div className="m-section-head">
            <h2>薄弱模块</h2>
            <button
              type="button"
              className="m-section-head__more bg-transparent border-none cursor-pointer"
              onClick={() => navigate('/wrong-book')}
            >
              全部 →
            </button>
          </div>
          <section
            className="m-card"
            style={{ padding: '8px 14px' }}
            data-testid="dashboard-mobile-weak"
          >
            <button
              type="button"
              className="m-list-row"
              onClick={() => handlePracticeWeak(weakModules[0].subject)}
              data-testid={`dashboard-mobile-weak-${weakModules[0].subject}`}
            >
              <div className="min-w-0">
                <div className="m-list-row__title">
                  {weakModules[0].subject}
                </div>
                <div className="m-list-row__meta">
                  错率 {Math.round((weakModules[0].wrongRate ?? 0) * 100)}%
                </div>
              </div>
              <span className="m-list-row__right m-list-row__right--err">
                急需
              </span>
            </button>
          </section>
        </>
      ) : null}

      <ExamCustomSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        exams={exams}
        onCreate={handleCreateExam}
        onDelete={handleDeleteExam}
      />
    </div>
  );
}
