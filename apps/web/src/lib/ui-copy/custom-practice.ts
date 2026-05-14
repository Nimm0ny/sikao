// CustomPracticeStart 文案 SSOT.
//
// 覆盖: views/CustomPracticeStart.tsx
// 调性: §1.3 行测专项练习引导. 不催, 中性.

export const CUSTOM_PRACTICE_COPY = {
  startFailedTitle:       '无法开始专项练习',
  startFailedDesc:        '请调整分类或题量后重试',
  facetsFailedTitle:      '专项分类加载失败',
  facetsFailedDesc1:      '分类来自题库真实标签',
  facetsFailedDesc2:      '加载失败时不使用本地兜底',
  emptyTitle:             '暂无可练分类',
  emptyDesc:              '当前题库没有可用于专项练习的行测分类',
  headerSubtitle1:        '从真实题库标签选择大类',
  headerSubtitle2:        '年份和题量',
  headerSubtitle3:        '创建一组只练当前目标的答题会话',
  topTypeDesc:            '按行测题型主分类选择训练范围',
  subtypeDescPart1:       '不选小类时',
  subtypeDescPart2:       '默认覆盖该大类下全部题',
  secondDescPart1:        '不选细分时',
  secondDescPart2:        '默认覆盖该小类下全部题',
  summaryTopFallback:     '该大类全部小类',
  customLabel:            '自定义题量',
  customHint:             '材料组按组原子加入',
  startCta:               '开始专项练习',
  sufficiencyShortPrefix: '少于请求的',
  sufficiencyLowPrefix:   '少于建议样本',
  sufficiencyLowBadge:    '数据积累中',
  sufficiencyMaxedPart1:  '本大类已全选',
  sufficiencyMaxedPart2:  '切换大类或等待题库扩充',
} as const;
