import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { RedirectGuard } from '@/components/auth/RedirectGuard';
import { RedirectPreserveQuery } from './RedirectPreserveQuery';
import { LEGACY_QUERY_PRESERVE_REDIRECTS, ROUTE_MAP, buildPracticeCenterPath } from './RouteMap';

const pages = {
  // PR-2 MVP (2026-05-14): /app → /study/today 今日提分任务首页.
  // sidebar 旧 /app#paper-list anchor.
  // 在 /practice/center/{subject}/{categories|papers} 4 sub-path, 老路径全 redirect.
  papers: lazy(() => import('@/views/Papers')),
  practiceCenter: lazy(() => import('@/views/PracticeCenter')),
  categoryTree: lazy(() => import('@/views/CategoryTree')),
  practiceStart: lazy(() => import('@/views/PracticeStart')),
  customPracticeStart: lazy(() => import('@/views/CustomPracticeStart')),
  practiceSession: lazy(() => import('@/views/PracticeSession')),
  result: lazy(() => import('@/views/Result')),
  wrongBook: lazy(() => import('@/views/WrongBook')),
  wrongQuestionDetail: lazy(() => import('@/views/WrongQuestionDetailView')),
  wrongQuestionRedo: lazy(() => import('@/views/WrongQuestionRedoView')),
  smartReview: lazy(() => import('@/views/SmartReviewView')),
  dashboard: lazy(() => import('@/views/Dashboard')),
  profile: lazy(() => import('@/views/Profile')),
  examCalendar: lazy(() => import('@/views/ExamCalendar')),
  conversationsHistory: lazy(() => import('@/views/ConversationsHistory')),
  essayPapers: lazy(() => import('@/views/EssayPapers')),
  essayPaperDetail: lazy(() => import('@/views/EssayPaperDetail')),
  essayGradingResult: lazy(() => import('@/views/EssayGradingResult')),
  essayHistory: lazy(() => import('@/views/EssayHistory')),
  // EssayShellSikao 双栏 + 草稿纸 + MmStrip 全套. EssayExam.tsx (旧 3 栏田字格)
  // 保留作 backup, 通过 EssayExamSikao 复用整套 query/hydrate/submit pipeline.
  essayExam: lazy(() => import('@/views/EssayExamSikao')),
  essayExamResults: lazy(() => import('@/views/EssayExamResults')),
  essaySpecialty: lazy(() => import('@/views/EssaySpecialty')),
  // EssayShellSikao mode='single-q'. EssaySpecialtyExam.tsx (旧 single mode)
  // 保留作 backup.
  essaySpecialtyExam: lazy(() => import('@/views/EssaySpecialtyExamSikao')),
  // /study-plan/history + /study-plan/history/:planId 两路由. 数据流方案 A
  // (0 BE 改): 复用 useStudyPlanToday + useStudyPlanHistory infinite query,
  // 客户端按周聚合.
  plan: lazy(() => import('@/views/Plan')),
  // 编辑器. 跟 ac87f2f Z1 BE 9 endpoint (/api/v2/notebook/*) 配对. 集成入口
  notesHome: lazy(() => import('@/views/NotesHome')),
  noteEditor: lazy(() => import('@/views/NoteEditor')),
  // device-aware shell — tablet landscape (TD1/TD1b) / tablet portrait (TD2)
  // / desktop fallback. P1 shell-only, 子布局 P2-P4 填.
  shenlunSession: lazy(() => import('@/views/ShenlunSession/ShenlunSession')),
  // MVP AI 公考提分闭环 (PR-1/2/6): study onboarding, diagnosis result, today page, progress
  studyOnboarding: lazy(() => import('@/views/study/Onboarding')),
  diagnosisResult: lazy(() => import('@/views/study/DiagnosisResult')),
  studyToday: lazy(() => import('@/views/study/StudyToday')),
  progress: lazy(() => import('@/views/Progress')),
  marketing: lazy(() => import('@/views/marketing').then((mod) => ({ default: mod.Marketing }))),
  login: lazy(() => import('@/views/auth/Login')),
  registerEmail: lazy(() => import('@/views/auth/RegisterEmail')),
  registerPhone: lazy(() => import('@/views/auth/RegisterPhone')),
  forgotPassword: lazy(() => import('@/views/auth/ForgotPassword')),
  resetPassword: lazy(() => import('@/views/auth/ResetPassword')),
  verifyEmailLanding: lazy(() => import('@/views/auth/VerifyEmailLanding')),
  bindEmail: lazy(() => import('@/views/auth/BindEmail')),
  bindPhone: lazy(() => import('@/views/auth/BindPhone')),
  completeProfile: lazy(() => import('@/views/auth/CompleteProfile')),
  health: lazy(() => import('@/views/Health')),
  notFound: lazy(() => import('@/views/NotFound')),
};

function routeElement(element: ReactElement): ReactElement {
  return <Suspense fallback={null}>{element}</Suspense>;
}

//   /           → Marketing（未登录着陆页；已登录自动跳 /app）
//   /login      → 极简 Login 页
//   /app        → 今日提分任务首页（已登录后主页）
//   /practice/* → 答题流（require-auth）
//   /wrong-book → 错题本（require-auth）
//   /dashboard  → 学情数据（require-auth；route path 保持 /dashboard 不改, sidebar
//                 redesign 2026-05-07 后 label 从"用户中心"改"学情数据", 跟 /profile=个人中心解耦）
//   /health     → Harness smoke probe（无 AppShell / 无 auth）
//
// AppShell 作 layout route（无 path 只有 element）包裹所有登录态业务路由，
// children 用绝对 path。RedirectGuard 做 redirect-if-authed / require-auth
// 两档保护。

export const router = createBrowserRouter([
  {
    path: '/',
    element: routeElement(
      <RedirectGuard mode="redirect-if-authed">
        <pages.marketing />
      </RedirectGuard>,
    ),
  },
  {
    path: ROUTE_MAP.login,
    element: routeElement(<pages.login />),
  },
  {
    // 改 redirect 到 /register/email. 外链 + 老书签自动跳转, 0 页面 404.
    path: '/register',
    element: <Navigate to="/register/email" replace />,
  },
  {
    path: '/register/email',
    element: routeElement(
      <RedirectGuard mode="redirect-if-authed">
        <pages.registerEmail />
      </RedirectGuard>,
    ),
  },
  {
    path: '/register/phone',
    element: routeElement(
      <RedirectGuard mode="redirect-if-authed">
        <pages.registerPhone />
      </RedirectGuard>,
    ),
  },
  {
    // user 也能进 (e.g. 帮另一台机的自己重置). reset-password 用 querystring
    // 传 token, 没 token 时 view 直接显示 expired 态.
    path: '/forgot-password',
    element: routeElement(<pages.forgotPassword />),
  },
  {
    path: '/reset-password',
    element: routeElement(<pages.resetPassword />),
  },
  {
    // P1-4: 不签 JWT, 仅翻 email_verified flag. 已登录用户也允许访问 (邮件
    // 链接可能在另一台机/登出态点开).
    path: '/verify-email',
    element: routeElement(<pages.verifyEmailLanding />),
  },
  {
    // username_legacy) 强制走 /complete-profile 补全至少一个 identifier
    // (90 天 deprecation 过渡期). RedirectGuard 对 needsIdentifierSetup=true
    // 自动 push 这条 path. 独立 layout (无 AppShell nav) 防 user 误点 nav
    // 绕过 gate.
    path: '/complete-profile',
    element: routeElement(
      <RedirectGuard mode="require-auth">
        <pages.completeProfile />
      </RedirectGuard>,
    ),
  },
  {
    path: '/health',
    element: routeElement(<pages.health />),
  },
  {
    // Figma Make full migration: the essay exam is a destination workspace, not
    // a normal logged-in app page. Keep auth, but do not wrap it in AppShell.
    path: '/essay/exam/:paperCode',
    element: routeElement(
      <RedirectGuard mode="require-auth">
        <pages.essayExam />
      </RedirectGuard>,
    ),
  },
  {
    element: routeElement(
      <RedirectGuard mode="require-auth">
        <AppShell />
      </RedirectGuard>,
    ),
    children: [
      // PR-2 MVP (2026-05-14): /app canonical 到今日提分任务首页.
      // /dashboard 仍保留为学情数据页, 老书签 / 外链自动跳转, 0 页面 404.
      { path: ROUTE_MAP.app, element: <Navigate to={ROUTE_MAP.dashboard} replace /> },
      // /practice/center 单一 hub. 顶层 view 行测/申论 tab + 2 大入口 (分类/套卷),
      // sub-route 复用现有 Papers/CategoryTree/EssayPapers/EssaySpecialty 4 view
      // (不重写, 同 lazy 模块挂多 path).
      //
      // 旧路径全 redirect 到新 canonical, 老书签/外链 0 404:
      //   /papers              → /practice/center/xingce/papers
      //   /xingce/specialty    → /practice/center/xingce/categories
      //   /categories          → /practice/center/xingce/categories (二级 redirect)
      //   /essay/papers        → /practice/center/essay/papers
      //   /essay/specialty     → /practice/center/essay/categories
      //   /essay/categories    → /practice/center/essay/categories (二级 redirect)
      //
      // /papers / /essay/papers 带 query (?region=&year=&paperType=&page=) 走
      // RedirectPreserveQuery 保留 search string; 其余 view 不消费 query 用普通
      // Navigate 即可.
      { path: ROUTE_MAP.practiceCenter, element: routeElement(<pages.practiceCenter />) },
      {
        path: buildPracticeCenterPath('xingce', 'categories'),
        element: routeElement(<pages.categoryTree />),
      },
      {
        path: buildPracticeCenterPath('xingce', 'papers'),
        element: routeElement(<pages.papers />),
      },
      {
        path: buildPracticeCenterPath('essay', 'categories'),
        element: routeElement(<pages.essaySpecialty />),
      },
      {
        path: buildPracticeCenterPath('essay', 'papers'),
        element: routeElement(<pages.essayPapers />),
      },
      {
        path: LEGACY_QUERY_PRESERVE_REDIRECTS.xingcePapers.from,
        element: <RedirectPreserveQuery to={LEGACY_QUERY_PRESERVE_REDIRECTS.xingcePapers.to} />,
      },
      {
        path: '/xingce/specialty',
        element: <Navigate to="/practice/center/xingce/categories" replace />,
      },
      {
        path: '/categories',
        element: <Navigate to="/practice/center/xingce/categories" replace />,
      },
      { path: '/practice/custom/start', element: routeElement(<pages.customPracticeStart />) },
      { path: '/practice/:paperCode/start', element: routeElement(<pages.practiceStart />) },
      { path: '/practice/sessions/:sessionId', element: routeElement(<pages.practiceSession />) },
      { path: '/practice/result/:sessionId', element: routeElement(<pages.result />) },
      { path: '/wrong-book', element: routeElement(<pages.wrongBook />) },
      //   /wrong-book/smart-review    智能复盘 view (5 mode + Flashcard + 日历)
      //   /wrong-book/:questionId     错题详情 DetailA 纵堆 collapsible
      //   /wrong-book/:questionId/redo 错题重做 DetailB 分栏挑战 + 计时器 + 蒙对检测
      // smart-review 必须在 :questionId 之前注册, 避免 'smart-review' 被当 questionId 解析.
      { path: '/wrong-book/smart-review', element: routeElement(<pages.smartReview />) },
      { path: '/wrong-book/:questionId', element: routeElement(<pages.wrongQuestionDetail />) },
      { path: '/wrong-book/:questionId/redo', element: routeElement(<pages.wrongQuestionRedo />) },
      { path: ROUTE_MAP.dashboard, element: routeElement(<pages.dashboard />) },
      { path: '/profile', element: routeElement(<pages.profile />) },
      // backend `frontend_base_url + /bind-email?token=...` 对齐 (中划线非斜线).
      { path: ROUTE_MAP.bindEmail, element: routeElement(<pages.bindEmail />) },
      { path: ROUTE_MAP.bindPhone, element: routeElement(<pages.bindPhone />) },
      { path: '/calendar', element: routeElement(<pages.examCalendar />) },
      { path: '/conversations', element: routeElement(<pages.conversationsHistory />) },
      // Slice 2d D1=B 独立 /essay 轨道. 单题练习 (/essay/practice/:questionId) 已
      // 下线 — 申论统一走 v2 整卷考场 (/essay/exam/:paperCode), EssayPaperDetail
      // 入口收敛到"进入考场".
      // 此路径走 redirect 保留 query (?region=&year=&paperType=&page=).
      // /essay/papers/:paperCode (单卷详情) 不在合并范围内 — 它是详情 view, 不是入口.
      {
        path: LEGACY_QUERY_PRESERVE_REDIRECTS.essayPapers.from,
        element: <RedirectPreserveQuery to={LEGACY_QUERY_PRESERVE_REDIRECTS.essayPapers.to} />,
      },
      { path: '/essay/papers/:paperCode', element: routeElement(<pages.essayPaperDetail />) },
      { path: '/essay/grades/:recordId', element: routeElement(<pages.essayGradingResult />) },
      { path: '/essay/history', element: routeElement(<pages.essayHistory />) },
      // 整卷模考成绩单 (N 个 EssayGradingRecord 聚合, fullScore 加权得分).
      // URL: /essay/exam/results?paperCode=xxx&ids=1,2,3&total=5
      // 必须放在 /essay/exam/:paperCode 之前 — react-router v6 score-based 静态段
      // 通常优先, 但显式排序更稳妥 (避免 results 被误识别成 paperCode).
      { path: '/essay/exam/results', element: routeElement(<pages.essayExamResults />) },
      // 列表 → 选题 → 单题答题 (复用 ExamShell mode='single') → 评分跳
      // /essay/grades/:recordId.
      //
      // /practice/center/essay/categories, 走 redirect. 单题答题
      // /essay/specialty/:questionId 是 destination view, 不在合并范围内.
      {
        path: '/essay/specialty',
        element: <Navigate to="/practice/center/essay/categories" replace />,
      },
      { path: '/essay/specialty/:questionId', element: routeElement(<pages.essaySpecialtyExam />) },
      // 不取代 /essay/exam/:paperCode (整卷模考), 走独立 sessionId-driven 入口.
      // P1 仅 shell, TopBar / MaterialPane / editors 在 P2-P4 填.
      {
        path: '/practice/essay/session/:sessionId',
        element: routeElement(<pages.shenlunSession />),
      },
      // EssayCategoryTree.tsx + 测试推后续清理, 暂保留.
      { path: '/essay/categories', element: <Navigate to="/practice/center/essay/categories" replace /> },
      // /study-plan/history* 路由 redirect 到 /plan 兼容老书签 / 外链.
      { path: '/plan', element: routeElement(<pages.plan />) },
      { path: '/study-plan/history', element: <Navigate to="/plan" replace /> },
      { path: '/study-plan/history/:planId', element: <Navigate to="/plan" replace /> },
      // MVP AI 公考提分闭环 (PR-1/2/6): 用户引导 + 今日任务 + 进度看板
      { path: ROUTE_MAP.studyOnboarding, element: routeElement(<pages.studyOnboarding />) },
      { path: '/study/diagnosis-result', element: routeElement(<pages.diagnosisResult />) },
      { path: ROUTE_MAP.studyToday, element: <Navigate to={ROUTE_MAP.dashboard} replace /> },
      { path: '/progress', element: routeElement(<pages.progress />) },
      // /notes/new 走同一 NoteEditor 组件 (内部 isNew = (noteId === 'new')). 集成
      { path: '/notes', element: routeElement(<pages.notesHome />) },
      { path: '/notes/:noteId', element: routeElement(<pages.noteEditor />) },
      // Catchall — 替代 react-router 默认的 "Hey developer 👋" dev 提示页 (例
      // /essay/practice 单题路由下线后访客直接访问). 落 layout 内, 沿用 AppShell
      // 头底, 给 user-friendly 404 + 返回题库 CTA.
      { path: '*', element: routeElement(<pages.notFound />) },
    ],
  },
]);
