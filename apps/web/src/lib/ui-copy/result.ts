// Result (报告) 矩阵 / hero / actions / module 文案 SSOT.
//
// 覆盖: components/result/*
// 调性: §1.3 不打鸡血, 中性陈述 + 建议. ink-first.

export const RESULT_COPY = {
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
