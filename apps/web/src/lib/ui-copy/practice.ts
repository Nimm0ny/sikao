// Practice (答题) 流程文案 SSOT.
//
// 覆盖: components/practice/* + 子目录 fb/* + 类似 settings popover / drawer / 类
// 调性: §1.3 答题中文案简短中性, 不催。

export const PRACTICE_COPY = {
  // AnswerCardDrawerHeader
  drawerLegend:           '答题卡图例',
  // AnswerCardPanel
  panelClose:             '关闭答题卡',
  // AnswerCardStickyTab
  stickyOpen:             '展开答题卡',
  // DrawerFooter
  drawerBackToCurrent:    '返回当前题',
  // ExitConfirmModal
  exitTitle:              '终止本次答题',
  exitDescPart1:          '当前进度将丢失',
  exitDescPart2:          '且无法恢复',
  exitDescPart3:          '如果只是想稍后回来',
  exitDescPart4:          '可以保留页面而不终止',
  exitAriaLabel:          '终止答题确认',
  // fb/FbActions
  fbActionsAddNote:       '添加到笔记本',
  // fb/FbBottomDock
  fbBottomDockOpenCard:   '打开答题卡',
  // fb/FbFloatingAnswerDrawer
  fbAnswerDrawerAriaLabel: '答题卡抽屉',
  fbAnswerDrawerTitle:    '答题卡',
  fbAnswerDrawerCollapse: '收起答题卡',
  fbAnswerDrawerExpand:   '展开答题卡',
  fbAnswerDrawerQuestionNav: '题号导航',
  // fb/FbDrawer
  fbDrawerClose:          '关闭答题卡',
  // fb/FbReadingCol
  fbJumpToParagraph:      '回跳材料段落',
  fbReadingMode:          '行测真题练习',
  fbReadingModeFull:      '行政职业能力测验',
  fbMaterialLabel:        '材料',
  fbMaterialCollapse:     '折叠材料',
  fbMaterialExpand:       '展开材料',
  fbMaterialImageAlt:     '材料图',
  fbMaterialTabList:      '题组题号',
  fbMaterialDone:         '题组已显示完毕',
  fbQuestionTypeSingle:   '单选题',
  fbQuestionTypeMultiple: '多选题',
  fbQuestionTypeTrueFalse: '判断题',
  // fb/FbScratchCol
  fbScratchHint:          '可拖入题干文字或数字',
  fbScratchAdd:           '写一条便签',
  fbScratchAriaLabel:     '新便签内容',
  // fb/FbSettingsPopover
  fbSettingsBreath:       '舒适更呼吸',
  fbSettingsCurrentOnly:  '仅本场答题生效',
  fbSettingsRoundSoft:    '圆形更柔和',
  fbSettingsSquareTool:   '方形更工具感',
  // fb/FbTF
  fbTfAriaLabel:          '题判断选项',
  // fb/FbTopbar
  fbTopbarAriaLabel:      '答题工具栏',
  fbTopbarBack:           '返回题库',
  fbTopbarPause:          '暂停',
  fbTopbarResume:         '继续',
  fbTopbarSettings:       '阅读设置',
  fbTopbarSubmit:         '交卷',
  fbTopbarTimer:          '答题计时',
  // fb/SelectionToolbar
  selectionAriaLabel:     '划线工具条',
  selectionClear:         '清除选区划线',
  // NoteEditor
  noteEditorQuestionLabel: '关联题号用',
  noteEditorPlaceholder:   '在这里写笔记',
  // PracticeTimer
  timerEnded:             '考试时间已到',
  // SessionHeader
  sessionHeaderPaused:    '计时已暂停',
  // SessionLoading
  sessionLoading:         '正在加载套卷蓝图',
  // SettingsPopover (top-level, non-fb)
  settingsMaterialFont:   '材料的阅读字号',
  settingsExamOnly:       '考场页生效',
  // ViewModeToggle
  viewModeComingSoon:     '模式即将上线',
  // Questions (renderers)
  fillBlankHint:          '输入答案后提交',
  fillBlankPlaceholder:   '在此输入答案',
  multipleChoiceHint:     '选择全部正确选项',
} as const;
