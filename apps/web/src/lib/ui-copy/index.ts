// ui-copy barrel — 所有 view 文案 SSOT 统一出口.
//
// 历史: 原 lib/ui-copy.ts (320 行 / 7 namespace). PR5c 收口时引入
// ~14 新 namespace, 单文件超 500 行 (CLAUDE.md §3.5 软上限) → 拆 barrel.
//
// 子模块命名约定 (按 view 域分):
//   system.ts          — EMPTY / ERROR / OFFLINE / AUTH / BYOM / LLM_QA / ESSAY / ESSAY_GRADING
//   dashboard.ts       — DASHBOARD_COPY  (dashboard + dashboard-sikao + home blocks 非 page-hero)
//   home.ts            — HOME_COPY       (HeroSection / CategoryChip / Continue / MoreFeatures / RecentWrongMini)
//   notes.ts           — NOTES_COPY      (capture / editor / home 整套 notes)
//   practice.ts        — PRACTICE_COPY   (答题 toolbar / drawer / 设置 / SessionHeader / Timer)
//   result.ts          — RESULT_COPY     (Hero / Actions / 矩阵 / 分项 / Timeline)
//   wrong-book.ts      — WRONG_BOOK_COPY (smart-review / redo / detail / heatmap)
//   essay-sikao.ts     — ESSAY_SIKAO_COPY (sikao 落地包 + specialty + filters)
//   exam.ts            — EXAM_COPY       (countdown / 公考)
//   plan.ts            — PLAN_COPY       (plan head 等)
//   custom-practice.ts — CUSTOM_PRACTICE_COPY (CustomPracticeStart view)
//   practice-center.ts — PRACTICE_CENTER_COPY (PracticeCenter /practice/center hub, PR16)
//   profile.ts         — PROFILE_COPY    (个人中心 + ProfilePreferences)
//   not-found.ts       — NOT_FOUND_COPY  (404)
//   auth-art.ts        — AUTH_ART_COPY   (LoginArtPanel)
//
// 调用: `import { EMPTY_COPY, WRONG_BOOK_COPY } from '@/lib/ui-copy'`
//
// 改文案 = 改对应子文件; 跨切片复用同一 key, 不要造重复 entry.

export {
  EMPTY_COPY,
  ERROR_COPY,
  BYOM_COPY,
  LLM_QA_COPY,
  ESSAY_COPY,
  ESSAY_GRADING_COPY,
  OFFLINE_COPY,
  AUTH_COPY,
} from './system';
export { DASHBOARD_COPY } from './dashboard';
export { HOME_COPY } from './home';
export { NOTES_COPY } from './notes';
export { PRACTICE_COPY } from './practice';
export { RESULT_COPY } from './result';
export { WRONG_BOOK_COPY } from './wrong-book';
export { ESSAY_SIKAO_COPY } from './essay-sikao';
export { EXAM_COPY } from './exam';
export { PLAN_COPY } from './plan';
export { CUSTOM_PRACTICE_COPY } from './custom-practice';
export { PRACTICE_CENTER_COPY } from './practice-center';
export { PROFILE_COPY } from './profile';
export { NOT_FOUND_COPY } from './not-found';
export { AUTH_ART_COPY } from './auth-art';
