// @sikao/domain — 前端业务模型与 hooks barrel
//
// 拆分子模块（每个领域一个文件夹）：
//   auth/            登录、token、user store
//   user/            UserGoal / Profile
//   question-bank/   题库领域模型
//   paper/           套卷、专项练习
//   answer-session/  答题会话状态机
//   xingce/          行测领域 hooks
//   shenlun/         申论领域 hooks
//   wrong-book/      错题本
//   favorite/        收藏
//   study-record/    学习记录
//   notes/           笔记本
//   llm/             LLM 会话
//
// 严禁把 UI 组件、API 请求实现写进本包。本包只暴露：
//   - 领域 hooks
//   - 领域类型
//   - 状态机 / store
//   - 派生逻辑（不带 fetch）
//
// 顶层 barrel 仅 re-export 跨视图通用的高频 store；其余通过子路径 import
// (e.g. `from '@sikao/domain/shenlun/useEssayDraft'`).

export { useAuthStore } from './auth/useAuthStore';
export { usePracticeStore } from './answer-session/usePracticeStore';
export { useAdjustmentBannerStore } from './dashboard/useAdjustmentBannerStore';
export { useDashboardPreferenceStore } from './dashboard/useDashboardPreferenceStore';
export { useRecommendationDraftStore } from './dashboard/useRecommendationDraftStore';
export { usePlanStore } from './plan/usePlanStore';
export { useAnswerSessionStore } from './practice/useAnswerSessionStore';
export { usePracticeStore as usePracticeCenterStore } from './practice/usePracticeStore';
export { useSessionConfigStore } from './practice/useSessionConfigStore';
export { useHighlightStore } from './xingce/useHighlightStore';
