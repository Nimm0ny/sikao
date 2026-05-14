/**
 * UI-copy for /study/* views: onboarding + today + diagnosis result.
 * PR-1 + PR-2 MVP.
 */

export const STUDY_COPY = {
  ONBOARDING: {
    TITLE: '设置你的备考目标',
    SUBTITLE: '帮我们了解你的情况，制定更适合你的学习计划',
    GOAL_LABEL: '目标分数',
    GOAL_PLACEHOLDER: '例如：130',
    GOAL_HINT: '国考行测申论各 75 分, 总分 150',
    EXAM_LABEL: '目标考试',
    EXAM_DATE_LABEL: '考试日期',
    EXAM_NAME_PLACEHOLDER: '例如：2026 国考',
    SELECT_EXAM: '从公告考试中选择',
    EXAM_DATE_PLACEHOLDER: '选择考试日期',
    CONFIRM: '开始备考',
    SKIP: '暂时跳过',
  },

  DIAGNOSIS: {
    TITLE: '你的初始诊断',
    SUBTITLE: '基于你的目标，这是今天的首要任务',
    XINGCE_FOCUS: '行测重点模块',
    ESSAY_FOCUS: '申论练习方向',
    START_TODAY: '开始今日任务',
    VIEW_PLAN: '查看学习计划',
  },

  TODAY: {
    TITLE: '今日任务',
    EMPTY_TITLE: '今天还没有学习任务',
    EMPTY_DESC: '去练习一套行测真题，或完成一篇申论练习',
    TASK_START: '开始',
    TASK_DONE: '已完成',
    TASK_SKIP: '跳过',
    TASK_SKIP_CONFIRM: '确认跳过这项任务？',
    ALL_DONE_TITLE: '今日任务全部完成！',
    ALL_DONE_DESC: '继续保持，明天见',
    GO_PRACTICE: '去练习',
    GO_ESSAY: '去申论',
    GO_WRONG_BOOK: '去错题本',
    GO_PROGRESS: '查看进度',
  },
} as const;
