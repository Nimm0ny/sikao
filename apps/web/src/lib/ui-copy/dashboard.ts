// Dashboard / Home blocks 文案 SSOT.
//
// 覆盖: components/dashboard/* + components/dashboard-sikao/* + components/home/*
// 调性: §1.3 不打鸡血, 不引导用户进 "加油!" 心态. 数据陈述 + 行动提示.

export const DASHBOARD_COPY = {
  // DashboardMetricCards
  metricTotalSuffix:      '的答题总量',
  metricAccuracyLabel:    '整体正确率',
  metricStreakHint:       '按本地日从今天倒推',
  metricMasteredSuffix:   '次自动掌握',
  // ExamCustomSheet
  examCustomTitle:        '自定义考试',
  examCustomEmpty:        '还没添加任何考试',
  examCustomEmptyHint:    '看到倒计时更有节奏',
  // HeatmapChart
  heatmapTitle:           '练习热力图',
  heatmapEmpty:           '暂无练习记录',
  heatmapEmptyHint:       '答过题后热力图会出现在这里',
  // HomeContinueBlock (dashboard variant)
  continueEmpty:          '暂无未完成的练习',
  continueEmptyHint:      '挑一套今天先做',
  // HomeTodayPlanBlock
  todayPlanEmpty:         '今日无计划',
  todayPlanEmptyHint:     '配置学习习惯后会自动生成每日节奏',
  todayPlanAccuracyLabel: '正确率目标',
  // HomeUpcomingExamsBlock
  upcomingEmpty:          '还没设置考试目标',
  upcomingEmptyHint:      '看到倒计时更有节奏',
  upcomingAddCta:         '添加考试目标',
  // HomeWeakModulesBlock
  weakEmpty:              '暂无薄弱模块',
  weakEmptyHint:          '今天的节奏先保持着',
  // KnowledgeBubbleChart
  knowledgeBubbleEmpty:   '暂无知识点数据',
  knowledgeBubbleEmptyHint: '答题后系统会按科目自动分析你的强项与弱项',
  knowledgeBubbleTitle:   '知识点掌握气泡图',
  knowledgeBubbleHeader:  '知识点掌握',
  // PracticeBreakdownCard
  breakdownPlannedHint:   '含计划内复习',
  breakdownWrongbookLink: '错题本独立入口',
  // RecentExamsList
  recentExamsEmpty:       '还没有练习记录',
  recentExamsEmptyHint1:  '完成一场练习后',
  recentExamsEmptyHint2:  '次会出现在这里',
  // RecentResultPreview
  recentResultFallback1:  '完成更多练习以解锁个性化建议',
  recentResultFallback2a: '建议先打通一套完整模考',
  recentResultFallback2b: '让系统沉淀基线数据',
  recentResultFallback3a: '错题本回顾上一阶段难点',
  recentResultFallback3b: '再触发新材料',
  recentResultAction1:    '错题本针对前两个考点优先重做',
  recentResultAction2:    '后续再触发新材料',
  recentResultWeakest:    '这是当前最大弱项',
  recentResultLowAcc:     '巩固空间大',
  recentResultEyebrow:    '最近一次模考',
  recentResultAriaLabel:  '最近一次模考',
  recentResultEmpty:      '暂无练习记录',
  recentResultEmptyDesc:  '完成首场练习后这里会显示最近一次表现',
  recentResultUntitled:   '未命名练习',
  // RecentWrongQuestions
  recentWrongEmpty:       '还没有错题',
  recentWrongEmptyHint:   '完成一次练习后错题会自动收录',
  // TrendLineChart
  trendEmpty:             '暂无趋势数据',
  trendTitle:             '正确率趋势',
  trendDayPrefix:         '天正确率趋势',
  // WeekStripCalendar
  weekCalendarTitle:      '本周练习节奏',
  // dashboard-sikao/PlanTasksCard
  planTasksEmpty:         '今日无任务',
  // dashboard-sikao/StreakCard
  streakBreakHint:        '今天打卡可破纪录',
  // dashboard-sikao/WeakPointsCard
  weakPointsEmpty:        '暂无薄弱考点数据',
  // Dashboard view (page-level)
  dashboardEyebrow:       '决断今天该练什么',
  dashboardEyebrowHint:   '从上到下顺着看',
  retryHint:              '请稍后重试',
} as const;
