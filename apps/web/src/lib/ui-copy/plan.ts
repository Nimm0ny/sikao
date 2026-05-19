// Plan (学习计划 / PlanHead 等) 文案 SSOT.
//
// 覆盖: components/plan/*

export const PLAN_COPY = {
  examEnded:              '考试已结束',
  examEndedNext:          '看看下一次目标',
  planRequireLogin:       '登录后即可查看你的学习计划。',
  planEmptyTitle:         '还没有学习计划',
  planEmptyDesc:          '去 Dashboard 启动今日推荐，然后回来看完整周视图。',
  planEmptyCta:           '回 Dashboard',
  planRetry:              '重试',
  planLoadedAll:          '加载完成',
  planAssistantKeep:      '不用，按原计划',
  planAssistantAdjust:    '好，调整一下',
  planAssistantKeepToast: '已记录你的偏好。',
  planAssistantAdjustToast: '计划调整功能即将上线。',
  planNarrativeNoTasks:   '今天没安排具体任务，给自己一段空白时间，回看一下上周三道错的题吧。',
  planNarrativeNotStarted: (total: number): string =>
    `今天有 ${total} 个任务在等你。一道题、一段笔记、一次复盘，哪个都行，关键是开始。`,
  planNarrativeInProgress: (completed: number, total: number): string =>
    `今天已完成 ${completed} / ${total} 任务。最后这几个就在你的节奏里，没什么需要赶。`,
  planNarrativeDone:      '今天的计划已全部完成。剩下的时间留给自己，看看明天的安排，或者只是合上电脑，去散个步。',
  progressEyebrow:        'Progress · 思考',
  progressTitle:          '备考进度',
  progressRequireLogin:   '登录后即可查看你的进度反馈。',
  progressLoadFailedTitle: '进度加载失败',
  progressLoadFailedDesc: '检查网络后重试。',
  progressRetry:          '重试',
  progressEmptyTitle:     '还没有进度记录',
  progressEmptyDesc:      '先去完成一组练习或一段计划，再回来对比这周的变化。',
  progressEmptyCta:       '去 Dashboard',
  progressOverviewTitle:  '本周概况',
  progressTrendTitle:     '行测正确率趋势',
  progressTrendEmpty:     '最近还没有趋势数据。',
  progressLatest:         '最近',
  progressPeak:           '峰值',
  progressWindowLabel:    '统计窗口',
  progressCountdownLabel: '距考试还有',
  progressDayUnit:        '天',
  progressBarAria:        '行测正确率趋势图',
  progressStatsXingce:    '行测题数',
  progressStatsEssay:     '申论提交',
  progressStatsStreak:    '连续天数',
  progressStatsTasks:     '任务完成',
  progressAccuracySuffix: (accuracy: number): string =>
    `${accuracy.toFixed(1)}% 正确率`,
  progressStreakValue: (days: number): string =>
    `${days} 天`,
  progressTasksValue: (completed: number, total: number): string =>
    `${completed}/${total}`,
  progressSubtitle: (weekStart: string, weekEnd: string): string =>
    `统计窗口 ${weekStart} — ${weekEnd}。把本周完成度和近阶段正确率放在一起看，下一步更清楚。`,
  progressTrendRangeLabel: (days: number): string =>
    `${days} 天`,
  progressNextActionTitle: '下一步',
  progressNextActionToPlan: '先把本周计划收口，再回来对比趋势。',
  progressNextActionToNotes: '这周主线已经跑完，去笔记本补一条总结，把经验沉下来。',
  progressNextActionToDashboard: '先从今日推荐开始，做出第一条记录后这里才会长出趋势。',
  progressNextActionPlanCta: '查看本周计划',
  progressNextActionNotesCta: '整理一条笔记',
  progressNextActionDashboardCta: '回 Dashboard',
  progressRemainingTasks: (remaining: number): string =>
    `还差 ${remaining} 个任务完成本周闭环。`,
} as const;
