// PracticeCenter (/practice/center) 文案 SSOT — PR16 (2026-05-13).
//
// 覆盖: views/PracticeCenter.tsx (顶层 hub: 行测/申论 tab + 2 大入口 card).
// 调性: §1.3 不打鸡血, "图书馆隔壁桌同学" — 用一句话说清"做什么"+"为什么".
//
// 路由:
//   /practice/center                      → PracticeCenter (本文案消费方)
//   /practice/center/xingce/categories    → CategoryTree (复用现有 view)
//   /practice/center/xingce/papers        → Papers (复用现有 view)
//   /practice/center/essay/categories     → EssaySpecialty (复用现有 view)
//   /practice/center/essay/papers         → EssayPapers (复用现有 view)
//
// 旧路由 /papers /xingce/specialty /essay/papers /essay/specialty 通过 router 层
// redirect 自动转到上述新 canonical path. 老书签 / 外链 0 404.

export const PRACTICE_CENTER_COPY = {
  pageEyebrow: '02 · Practice / Center',
  pageTitle: '练习中心',
  pageSubtitle: '挑科目, 再决定按章节专攻还是按整卷模考.',
  subjects: {
    xingce: '行测',
    essay: '申论',
  },
  subjectsAriaLabel: '科目选择',
  entries: {
    categories: {
      title: '分类练习',
      description: '按章节 / 题型筛题, 针对薄弱知识点反复打磨.',
    },
    papers: {
      title: '套卷练习',
      description: '完整时间模拟真考节奏, 国考 / 省考真题套卷.',
    },
  },
} as const;
