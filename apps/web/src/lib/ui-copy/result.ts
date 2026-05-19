// Result (报告) 矩阵 / hero / actions / module 文案 SSOT.
//
// 覆盖: components/result/*
// 调性: §1.3 不打鸡血, 中性陈述 + 建议. ink-first.

export const RESULT_COPY = {
  status: {
    loadingTitle: '练习结果',
    retry: '重试',
    home: '回首页',
    homeMobile: '返回首页',
  },
  header: {
    badge: '结果',
    mobileEyebrow: '本次练习',
  },
  hero: {
    accuracyLabel: '本次正确率',
    scorePrefix: '得分',
    scoreUnit: '分',
  },
  metrics: {
    correct: '正确',
    wrong: '错误',
    unanswered: '未答',
    total: '总题',
    duration: '用时',
    answered: '已答',
    answeredPrefix: '共',
    newWrong: '新错题',
    addedToBook: '已入册',
    emptyDelta: '—',
    durationUnit: '分',
  },
  next: {
    title: '下一步',
    eyebrow: '下一步建议',
    wrongReviewTitle: '先看本套错题',
    wrongReviewDescription: '先把错因改清楚，再决定要不要重做。',
    wrongHeavyTitle: '先停在错题本',
    wrongHeavyDescription: '错题偏多，先把薄弱项和错因补清楚。',
    allCorrectTitle: '继续下一组',
    allCorrectDescription: '本次全对，直接进入下一组练习。',
    pendingWrong: (count: number) => `${count} 道待复盘`,
    noWrong: '本次无错题',
    primaryWrong: '看本套错题',
    primaryRetry: '再来一组',
    retry: '再做一次',
    note: '去笔记',
    plan: '学习计划',
    home: '回首页',
  },
  review: {
    title: '复盘',
    clear: '清零',
    wrongChip: (count: number) => `${count} 错`,
    empty: '没有错题',
    questionLabel: (questionNo: number) => `第 ${questionNo} 题`,
    selectedPrefix: '选',
    correctPrefix: '对',
    reasonAria: (questionNo: number) => `第 ${questionNo} 题错因`,
  },
  weak: {
    title: '薄弱项',
    empty: '暂无分类数据',
  },
  mobile: {
    wrongTitle: '错题速看',
    viewAll: (count: number) => `全部 ${count} 题 →`,
    noWrong: '本次全对，直接进入下一组。',
    youChose: '你选',
    correctAnswer: '正解',
    wrongMark: '错',
    viewWrongAria: (questionNo: number) => `查看错题 ${questionNo}`,
    askAria: (askButtonLabel: string, questionNo: number) =>
      `${askButtonLabel} · 第 ${questionNo} 题`,
    nextCardTestId: 'result-mobile-next-card',
    primaryActionTestId: 'result-mobile-primary-action',
    notesActionTestId: 'result-mobile-notes-action',
  },
  actions: {
    notesTitle: '沉淀',
    notesDescription: '保存本次复盘入口',
    notesLabel: '去笔记',
    planTitle: '计划',
    planDescription: '把薄弱项放入计划',
    planLabel: '调整计划',
    aiTitle: 'AI 问答',
    aiDescription: '围绕本次结果提问',
    aiLabel: '打开',
  },
  // AiSuggestionCard
  aiSuggestion:           '建议针对这个考点专项练习',
  // AnswerCardPanel (result variant)
  panelJumpToExplanation: '跳转到解析',
  // AnswerComparisonGrid
  comparisonByModule:     '按模块分段',
  comparisonClickHint:    '点击题号看解析',
  // ResultActions
  actionsNoPaperWarn1:    '本场没有试卷编号',
  actionsNoPaperWarn2:    '无法定位本套错题',
  actionsViewWrong:       '看本套错题',
  // ResultHero (banner copy across 5 score buckets)
  heroHighStable:         '高分段稳健',
  heroHighStableHint:     '把节奏保住就好',
  heroMidStable:          '稳定段中游',
  heroMidStableHint:      '找一个掉链子的板块补上去',
  heroPassed:             '已过及格线',
  heroPassedHint:         '距高分段还差一两个模块',
  heroWeakModulePrio:     '优先复盘最弱模块的方法论',
  heroBasicHold:          '先稳住基础题节奏',
  heroBasicHoldHint:      '别陷在难题里',
  heroSameAsLast:         '跟上次持平',
  heroNextWeakRetake:     '把弱项专项做掉',
  heroNextRunFull:        '再做一次完整模考',
  heroPriorityFreq:       '优先看错题里的高频题型',
  heroCtaNextWrong:       '下一步看错题',
  heroCtaFreqFirst:       '把高频题型先扫一遍',
  // ResultTabNav
  tabNavAriaLabel:        '结果分页导航',
  // ScoreModuleCard
  moduleAccuracyLabel:    '分项准确率',
  moduleStartFromLowest:  '从最低项开始复盘',
  moduleAvoidAverage:     '避免平均用力',
  // SectionAccuracyCard
  sectionAccuracyTitle:   '分区正确率',
  // TimingByModule
  timingSubjectVerbal:    '言语理解与表达',
  timingPerModule:        '每模块实际用时',
  timingUntrackedSuffix:  '个模块未在统计内',
  // TimingTimeline
  timingPerQuestion:      '每题用时分布条',
  // WrongReviewCard
  wrongReviewSeeFull:     '查看完整解析',
  // TweaksDrawer
  tweaksBreath:           '舒适更呼吸',
  tweaksLayoutVertical:   '或顶部水平条',
  tweaksReset:            '恢复默认偏好',
  // ImageLightbox
  lightboxClose:          '关闭放大图',
} as const;
