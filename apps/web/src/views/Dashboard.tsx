import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroGreeting } from '@/components/dashboard-sikao';
import {
  ExamCustomSheet,
  HomeContinueBlock,
  HomeTodayPlanBlock,
  HomeUpcomingExamsBlock,
  HomeWeakModulesBlock,
  type ExamFormInput,
} from '@/components/dashboard';
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
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import { DashboardMobile } from './dashboard/DashboardMobile';

/**
 * Dashboard — SIKAO Wave 8 Phase C 落地 (lhr 2026-05-12 决议).
 *
 * Home 4-block layout 严格顺序 (mobile-style-guide §3.3 + B14):
 *   1. 继续学习      — useContinueLastSession 上次中断点
 *   2. 今日计划      — useTodayStudyPlan 今日 task chip + 完成进度
 *   3. 临考冲刺      — useUpcomingExams 多 exam 自定义 (chip 切换)
 *   4. 薄弱模块      — useWeakModules({limit:2}) weakness score top 1-2
 *
 * 旧 SIKAO Wave 1 02-hifi (FocusCard / StreakCard / WeekRhythmCard / PlanTasksCard
 * / AiHintCard / MetricsRow / WeakPointsCard / 6 query) 已**全部退役**.
 * 错题最多 raw 数据移到 /dashboard 数据 tab (Wave 9 后续 slice), Home 不挤.
 *
 * Wave 8 Phase D (2026-05-12): 已切到真 useQuery hook (useHomeData.ts),
 * Phase C mock (useHomeMocks.ts) 已删. 4 hook 1:1 wrap BE endpoint, 见
 * src/hooks/useHomeData.ts.
 *
 * 纵向预算 (CLAUDE.md §4 + mobile-style-guide §1):
 *   HeroGreeting (~120px) + 4 block × 150px each = ~720px ≤ 1 屏 (1080p viewport
 *   ~937px content height). 不超 2 屏硬约束.
 */

const SUBJECT_TO_PATH: Record<WeakModule['subject'], string> = {
  // 五科都跳 /xingce/specialty 入口 (subject 透 URL hash 让 view 自滚到对应 anchor).
  // Wave 8 Phase D 加 ?subject=X query param 后改 path.
  言语: '/xingce/specialty#言语',
  数量: '/xingce/specialty#数量',
  判推: '/xingce/specialty#判推',
  资分: '/xingce/specialty#资分',
  常识: '/xingce/specialty#常识',
};

function hourGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return '深夜好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });
const DAY_FMT = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

function formatHeroEyebrow(now: Date): string {
  const wd = WEEKDAY_FMT.format(now).toUpperCase();
  const m = MONTH_FMT.format(now).toUpperCase();
  const d = DAY_FMT.format(now);
  const weekNumber = Math.ceil(
    ((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
      86_400_000 +
      1) /
      7,
  );
  return `${wd} · ${d} ${m} · WEEK ${weekNumber}`;
}

/**
 * Dashboard — device-aware dispatch shell (PR9, 2026-05-13).
 *
 * mobile (<1024)  → DashboardMobile (M1 · Home layout)
 * tablet/desktop  → DashboardDesktop (原 4-block grid layout 保留)
 *
 * Handoff §5.1: 不新建 views/m/*.tsx; 子组件共享 hooks (各自调用, react-query
 * cache 自动 dedupe 同一 query key), state 不跨层. 切换 device 时其中一个
 * unmount 另一个 mount, react-query cache 立刻命中, 不会丢请求结果.
 */
export default function Dashboard() {
  const device = useDevice();
  if (device === 'mobile') return <DashboardMobile />;
  return <DashboardDesktop />;
}

function DashboardDesktop() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const displayName = user?.displayName ?? user?.username ?? '同学';

  // ── Wave 8 Phase D: real useQuery hooks (useHomeData.ts) ─────────────
  const continueQ = useContinueLastSession();
  const planQ = useTodayStudyPlan();
  const examsQ = useUpcomingExams();
  const weakQ = useWeakModules({ limit: 2 });

  const lastSession = continueQ.data ?? null;
  const plan = planQ.data ?? null;
  const exams = examsQ.data?.exams ?? [];
  const weakModules = weakQ.data?.modules ?? [];

  // ── Sheet open state ──────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  // ── Hero ──────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const heroEyebrow = formatHeroEyebrow(now);
  const heroGreeting = `${hourGreeting(now)}，${displayName}。`;
  // sub 简化版: 不再依据 weakestPoint 编故事, Wave 8 Phase C 改保持中性 -
  // mobile-style-guide §1 "不打鸡血, 不强化焦虑".
  const heroSub = '4 个 block 决断今天该练什么。从上到下顺着看。';

  // ── Block 1: 继续学习 callbacks ───────────────────────────────────────
  const handleContinue = useCallback(
    (session: PracticeSessionSummary) => {
      navigate(`/practice/sessions/${session.id}`);
    },
    [navigate],
  );

  const handleStartNew = useCallback(() => {
    navigate('/papers');
  }, [navigate]);

  // ── Block 2: 今日计划 callbacks ───────────────────────────────────────
  const handleGoToPlan = useCallback(() => {
    navigate('/plan');
  }, [navigate]);

  const handleCreatePlan = useCallback(() => {
    navigate('/profile#study-plan');
  }, [navigate]);

  // ── Block 3: 临考冲刺 callbacks ──────────────────────────────────────
  const handleOpenSheet = useCallback(() => {
    setSheetOpen(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  // Wave 8 Phase D wire: real mutation hooks (useHomeData.ts), invalidate
  // userExamsAll prefix → useUpcomingExams 自动 refetch list.
  const createExamMut = useCreateUserExam();
  const deleteExamMut = useDeleteUserExam();

  const handleCreateExam = useCallback(
    (input: ExamFormInput) => {
      createExamMut.mutate(
        {
          name: input.name,
          examDate: input.examDate,
          notes: input.notes,
        },
        {
          onError: (err) => {
            logger.error('[dashboard] create exam failed', { err: String(err) });
            toast.error('保存失败', '请稍后重试');
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
          logger.error('[dashboard] delete exam failed', {
            err: String(err),
            examId,
          });
          toast.error('删除失败', '请稍后重试');
        },
      });
    },
    [deleteExamMut],
  );

  // ── Block 4: 薄弱模块 callbacks ──────────────────────────────────────
  const handlePracticeWeak = useCallback(
    (subject: WeakModule['subject']) => {
      const path = SUBJECT_TO_PATH[subject];
      navigate(path);
    },
    [navigate],
  );

  return (
    <div
      className="p-4 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6 md:gap-8"
      data-testid="dashboard-view"
    >
      <HeroGreeting
        eyebrow={heroEyebrow}
        greeting={heroGreeting}
        sub={heroSub}
        todayMeta="HOME · 4 / 4"
      />

      {/* 4-block 严格顺序 layout — desktop 4 列, tablet 2x2, mobile 1 列纵堆 */}
      <section
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        data-testid="dashboard-home-blocks"
      >
        <HomeContinueBlock
          lastSession={lastSession}
          onContinue={handleContinue}
          onStartNew={handleStartNew}
        />
        <HomeTodayPlanBlock
          plan={plan}
          onGoToPlan={handleGoToPlan}
          onCreatePlan={handleCreatePlan}
        />
        <HomeUpcomingExamsBlock
          exams={exams}
          onOpenSheet={handleOpenSheet}
        />
        <HomeWeakModulesBlock
          modules={weakModules}
          onPractice={handlePracticeWeak}
        />
      </section>

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
