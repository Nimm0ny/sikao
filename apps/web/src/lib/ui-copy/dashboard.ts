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
  taskKindLabel: {
    practice: '行测练习',
    review_wrong: '错题复盘',
    essay_writing: '申论练习',
  },
  taskFallbackSubtitle: '今日任务',
  status: {
    loading: '正在加载',
    error: '接口加载失败，请稍后重试。',
  },
  auth: {
    title: '登录状态已失效',
    description: '重新登录后即可回到 Dashboard 查看今日任务。',
    action: '前往登录',
  },
  loop: {
    title: '学习闭环',
    currentLabel: '当前阶段',
    stages: {
      plan: '今日计划',
      practice: '今日练习',
      diagnosis: '结果诊断',
      review: '错题复盘',
      notes: '笔记沉淀',
      adjust: '计划调整',
      feedback: '进度反馈',
    },
    hints: {
      plan: '先定今天该处理的任务',
      practice: '完成主任务或继续上次练习',
      diagnosis: '用结果判断下一步',
      review: '优先处理高频错题',
      notes: '把错因沉淀成笔记',
      adjust: '把计划压回可执行范围',
      feedback: '看进度后进入下一轮',
    },
  },
  sections: {
    nextActions: '下一步行动',
    insights: '学习洞察',
    overview: '今日概览',
  },
  actions: {
    wrongBook: {
      title: '加入错题重做',
      description: '把本周高频错题重新打一遍，先处理最影响提分的模块。',
      label: '去错题本',
    },
    notes: {
      title: '生成复盘笔记',
      description: '把练习结果沉淀成可复用笔记，后续复盘不用重新翻卷。',
      label: '打开笔记',
    },
    plan: {
      title: '下一步计划',
      description: '查看本周安排和完成情况，把任务量压回可执行范围。',
      label: '查看计划',
    },
    essay: {
      title: '申论训练',
      description: '进入申论套卷或专项，完成写作后查看评分与建议。',
      label: '进入申论',
    },
  },
  main: {
    chip: '今日主任务',
    completedSuffix: '已完成',
    title: '今日主任务',
    start: '继续主任务',
    starting: '正在创建练习',
    skip: '跳过今日任务',
    skipFailed: '跳过任务失败',
    retry: '重试加载',
    emptyTitle: '今日计划为空',
    emptyDescription: '可以先进入练习中心选择专项或套卷。',
    completeTitle: '今日计划已完成',
    completeDescription: '可以进入错题本复盘，或补一组薄弱专项保持手感。',
    extraPractice: '加练一组',
  },
  exam: {
    title: '考试倒计时',
    calendarLabel: '考试日历',
    empty: '还没有设置目标考试，建档后可在计划里补充。',
    today: '今天',
    dayUnit: '天',
    afterSuffix: '天后',
    pastPrefix: '已过',
  },
  weak: {
    title: '薄弱模块趋势',
    empty: '暂无错题统计，先完成一次练习后再看趋势。',
  },
  ai: {
    title: 'AI 建议',
    empty: '先完成一套行测或一次申论训练，系统会基于结果生成更明确的建议。',
    topModuleSuffix: '是当前优先模块，建议先做专项训练，再回到错题本复盘原因。',
  },
  planMini: {
    title: '今日计划',
    open: '查看',
    empty: '暂无计划任务。',
    pending: '待完成',
    handled: '已处理',
  },
  recent: {
    title: '最近练习',
    empty: '还没有未完成练习。',
    resume: '继续练习',
    openPractice: '去练习中心',
    questionUnit: '题',
  },
  progress: {
    title: '学习进度',
    label: '今日完成',
    learned: '已学',
    total: '总任务',
    groupUnit: '组',
  },
} as const;
