// Essay sikao 落地包 + specialty 文案 SSOT.
//
// 覆盖: components/essay/sikao/* + components/essay/specialty/* + components/essay/papers/*
//       components/essay/EssayDimensionsRadar.tsx
// 调性: §1.3 不打鸡血, 评分文案在 system.ts 的 ESSAY_GRADING_COPY 兜底.

export const ESSAY_SIKAO_COPY = {
  // EssayDimensionsRadar
  radarAriaLabel:         '维度评分雷达图',
  // papers/FiltersPanel
  filtersXingce:          '行测真题筛选',
  filtersEssay:           '申论真题筛选',
  // sikao/CiteBar
  citeJumpToSource:       '跳到引用源',
  // sikao/EditorPanel
  editorAddToNotebook:    '添加到笔记本',
  // sikao/EssayTopbar
  topbarExitFocus:        '退出专注模式',
  topbarFocusEssay:       '专注大作文',
  topbarSubmitEssay:      '提交申论作答',
  // ShenlunSession/TopBar (PR13 P2) — 60px 单行 TD1 工具条文案. 跟 sikao/EssayTopbar
  // 的「专注模式 / 暂停 / 设置」按钮场景不同 (TD1 spec §2.3 删了这些 caption),
  // 单独列 key 防文案漂移.
  topbarPrevQuestion:        '上一题',
  topbarNextQuestion:        '下一题',
  topbarSubmitGrade:         '提交批改',
  topbarSaveStatusSaved:     '已保存',
  topbarSaveStatusSaving:    '保存中…',
  topbarSaveStatusUnsaved:   '未保存',
  topbarWordCountLabel:      '字数',
  topbarElapsedAriaLabel:    '已用时',
  // ShenlunSession/MaterialPane (PR13 P2) — 左 340 材料阅读区. 题号 chip 文案
  // 由 question.label (mock 数据) 提供, 这里只兜底 a11y label + section caption.
  // chip nav 实际驱动的是 material 选择 (chip label = material.title), 所以
  // aria-label 用「材料导航」语义对齐.
  materialPaneNavAriaLabel:  '材料导航',
  materialPaneQuestionsCap:  '四题 · 拼续作答',
  materialPaneMaterialsCap:  '给定材料',
  // sikao/MaterialClip
  materialClipDragHint:   '拖到草稿或编辑器',
  // sikao/ScratchClip
  scratchClipDelete:      '删除草稿片段',
  // sikao/ScratchPad
  scratchPadDragHint:     '拖入材料短语',
  scratchPadAddNote:      '添加自由便签',
  scratchPadEmpty:        '从左侧材料拖入划线短语',
  // specialty/CategoryCard
  specialtyImporting:     '题库导入中',
  specialtyPreparing:     '题库准备中',
  specialtyPickSub:       '选一子项专攻',
  // specialty/ResumeHero
  resumeHere:             '上次练到这里',
  // specialty/StatStrip
  statXingceOverview:     '行测专项总览',
  statEssayOverview:      '申论专项总览',
  // ShenlunSession (PR13 P1) — device fallback. 申论考场仅在平板形态投产, 桌面/手机
  // 走指引页, 不渲染半成品布局.
  shenlunDesktopFallback: '申论考场为平板形态优化，请在 iPad / Surface 等平板设备打开。',
  // ShenlunSession/TypedEditor + HandwriteEditor (PR13 P3) — 双模 editor 文案.
  // typedEditorPlaceholder 跟 EditorPanel 原 hardcode "在此作答…" 等同 (P5 全
  // 收口走 SSOT 后 EditorPanel 也指向这里). handwriteEditorAriaLabel 给 canvas
  // role=img 用; eraseAriaHint 是橡皮模式提示 (P4 OcrPanel 触发 visible).
  typedEditorPlaceholder:    '在此作答…',
  handwriteEditorAriaLabel:  '手写作答区',
  handwriteEraseAriaHint:    '橡皮模式 · 按住二级按键',
  // ShenlunSession/OutlineAside (PR13 P4) — 32px 浮条 label + 五段法 prefill.
  // outlineAsideLabel 默认 collapsed 浮条 data-label (handoff §2.5 spec); 用
  // 中点 (·) 是 SIKAO label 调性, 跟 "解析 · 笔记 · AI" 同款. prefill 给 textarea
  // 当 default value (用户首次进入题目时, 五段法骨架自动出现, 直接在每段填内容).
  outlineAsideLabel:         '大纲 · 五段法',
  outlineAsideCollapseAria:  '收起大纲',
  outlineAsideExpandAria:    '展开大纲',
  outlineAsidePlaceholder:   '在这里写你的五段法大纲…',
  outlineAsidePrefillFive:   '1. 引论\n2. 论证 1\n3. 论证 2\n4. 论证 3\n5. 结论',
  // ShenlunSession/OcrPanel (PR13 P4) — Pencil 模式专属 240w 右栏. P4 stub 阶段
  // OCR 端上模型未就位 → ocrPanelDisabled 兜底文案 (handoff §7 风险 mitigation
  // "不禁用手写本身"); 双轨提交 IconBtn (OCR / 手写原稿) 在 stub 状态下: OCR
  // 按钮 disabled, 手写原稿是唯一活跃 CTA (避免一屏 ≥2 主 CTA, CLAUDE.md §4).
  ocrPanelTitle:                 'OCR 识别 · 一句一对照',
  ocrPanelDisabled:              '识别服务暂未启用，已保存原始手写答案。',
  ocrPanelSubmitOcrLabel:        '提交 OCR 文本',
  ocrPanelSubmitHandwrittenLabel:'提交手写原稿',
} as const;
