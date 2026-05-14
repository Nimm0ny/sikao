// System-level 文案 SSOT (empty / error / offline / auth / BYOM / LLM-QA / essay-core).
//
// 调性参照 docs/design/style-guide.md §1.3 Voice & Tone:
// "图书馆隔壁桌的同学" — 安静、靠谱、不打鸡血。
// 禁词: emoji / 亲～ / 宝宝 / 小可爱 / 开小差 / 双感叹号
//
// 所有 view 的空 / 错 / 离线文案统一从此读取, 禁止散落在各 view 内联。
// 改文案 = 改本文; 跨切片复用同一 key, 不要造重复 entry。

export const EMPTY_COPY = {
  papers:            { title: '暂无可练习的试卷',     description: '题库正在更新，稍后再来。' },
  wrongBook:         { title: '暂无错题',             description: '继续保持。' },
  wrongBookFiltered: { title: '没有符合筛选的错题',   description: '换个筛选试试。' },
  practiceHistory:   { title: '还没有练习记录',       description: '从首页选一套试卷开始。' },
  // result 页错题解析空态 — 语义 ≠ wrongBook (那是仓库空; 这里是本次答对所有).
  wrongReview:       { title: '本次全部答对',         description: '保持这个节奏。' },
} as const;

export const ERROR_COPY = {
  dashboard:       { title: '数据加载失败',      description: '稍后重试。' },
  dashboardCard:   { title: '此卡数据加载失败',  description: '可单独重试。' },
  paperLoad:       { title: '试卷加载失败',      description: '检查网络后重试。' },
  paperNotFound:   { title: '试卷不存在',        description: '可能已被下架或链接有误。' },
  session:         { title: '会话加载失败',      description: '检查网络后重试。' },
  sessionSubmit:   { title: '提交失败',          description: '答案已暂存，重试或稍后再来。' },
  result:          { title: '报告加载失败',      description: '检查网络后重试。' },
  wrongBook:       { title: '错题加载失败',      description: '检查网络后重试。' },
  profileStats:    { title: '统计加载失败',      description: '可单独重试。' },
  loginCredential: { title: '账号或密码错误',    description: '请检查后重试。' },
  loginNetwork:    { title: '登录失败',          description: '检查网络后重试。' },
  registerTaken:        { title: '用户名已被使用',    description: '换一个或直接登录。' },
  registerEmailTaken:   { title: '该邮箱已被使用',    description: '直接登录或换一个邮箱。' },
  registerPhoneTaken:   { title: '该手机号已被使用',  description: '直接登录或换一个手机号。' },
  registerCodeInvalid:  { title: '验证码错误或已过期', description: '请重新获取后再试。' },
  registerSmsRateLimit: { title: '请求太频繁',        description: '请稍后再试。' },
  registerWeak:         { title: '密码强度不足',      description: '至少 6 位。' },
  registerNetwork:      { title: '注册失败',          description: '检查网络后重试。' },
  // commit #6i: bind/unbind 错误文案 (登录后改邮箱/手机 + 解绑保护).
  bindEmailTaken:       { title: '该邮箱已被使用',    description: '换一个邮箱或先解绑原账号。' },
  bindPhoneTaken:       { title: '该手机号已被使用',  description: '换一个手机号或先解绑原账号。' },
  bindCodeInvalid:      { title: '验证码错误或已过期', description: '请重新获取后再试。' },
  bindTokenInvalid:     { title: '验证链接已失效',    description: '重新申请后再试。' },
  bindPasswordWrong:    { title: '密码错误',          description: '请检查后重试。' },
  bindAlreadyBound:     { title: '已绑定相同的标识',  description: '无需重复操作。' },
  bindNetwork:          { title: '操作失败',          description: '检查网络后重试。' },
  unbindBlocked:        { title: '需保留验证方式',    description: '至少保留邮箱或手机其一。' },
  examCalendar:       { title: '日历加载失败',      description: '检查网络后重试。' },
  essayHistory:       { title: '批改历史加载失败',  description: '检查网络后重试。' },
  studyPlanHistory:   { title: '历史加载失败',      description: '检查网络后重试。' },
  studyPlanDetail:    { title: '加载失败',          description: '检查网络后重试。' },
  studyPlanDetailNotFound: { title: '学习计划不存在', description: '可能已被删除或链接有误。' },
  llmUsage:           { title: '服务用量加载失败',    description: '检查网络后重试。' },
  llmConfigs:         { title: '评分服务配置加载失败', description: '检查网络后重试。' },
  llmConfigSsrf:      { title: '不允许的 URL',       description: '只能用 https:// 或 http://localhost (开发).' },
  llmConfigTaken:     { title: '名称重复',           description: '换一个 label 名称.' },
  llmQaUpstream:      { title: '服务暂时不可用',      description: '稍后再试.' },
  llmQaTimeout:       { title: '解析响应超时',        description: '检查网络后重试.' },
  llmQaNetwork:       { title: '解析网络异常',        description: '检查网络后重试.' },
  llmQaInternal:      { title: '会话状态异常',      description: '刷新页面后重试.' },
  llmQaPersistence:   { title: '对话保存失败',      description: '稍后重试或换个问题.' },
  llmQaUnknown:       { title: '未能完成回答',      description: '稍后重试.' },
  llmQaListLoad:      { title: '历史会话加载失败',  description: '检查网络后重试.' },
} as const;

// BYOM (user-owned scoring service) 文案. 调性按 §1.3 中性, 不打鸡血.
export const BYOM_COPY = {
  cardTitle:          '评分服务设置',
  cardSubtitle:       '支持自定义评分服务（可选）',
  emptyHint:          '还没有自定义服务. 默认使用系统配置.',
  addNew:             '添加服务',
  edit:               '编辑',
  delete:             '删除',
  setDefault:         '设为默认',
  isDefault:          '当前默认',
  test:               '测试连通性',
  testing:            '测试中…',
  deleteConfirm:      '确认删除此服务配置？删除后将回退到系统默认.',
  // 字段 label / placeholder
  labelLabel:         '名称',
  labelPlaceholder:   '例: 我的评分服务',
  baseUrlLabel:       'API 地址',
  baseUrlPlaceholder: 'https://api.openai.com/v1',
  apiKeyLabel:        'API Key',
  apiKeyPlaceholder:  'sk-...',
  apiKeyEditHint:     '留空表示不修改现有 key.',
  modelLabel:         '服务 ID',
  modelPlaceholder:   '例: service-main',
  saveBtn:            '保存',
  saving:             '保存中…',
  cancelBtn:          '取消',
  // test status 文案 (按 backend Literal 字面量映射)
  testStatusOk:       '连通正常',
  testStatusAuth:     '认证失败 (检查 API Key)',
  testStatusTimeout:  '超时 (检查网络 / endpoint)',
  testStatusUnreach:  '不可达 (检查 URL / 网络)',
} as const;

// 解析问答 (Slice 1b) 文案. 调性 §1.3: 中性陈述, 不打鸡血.
// 不叫"助手 / 智能问答" — 后者太营销化.
//
// PR10 (2026-05-13) 增量: AskDrawer (mobile/tablet/desktop 三态 sheet/drawer)
// 复用本 namespace, 不新建 AI_ASK_COPY (避免 SSOT 双轨). 增 askDrawerTitle /
// askPrompts / askRoundLimit 三个 entry; 既有 entry 保持向后兼容.
export const LLM_QA_COPY = {
  // 入口
  askButton:         '问解析',
  askButtonShort:    '问解析',          // 同字段, 留 future 区分桌面/紧凑.
  panelTitle:        '解析问答',
  // PR10 AskDrawer 三态宿主标题 fmt — "问 · 第 N 题" (设计稿 M3 .sheet-head h3).
  askDrawerTitle:    (n: number): string => `问 · 第 ${n} 题`,
  // PR10 AskDrawer 推荐 prompt chips (3 条铁线 — 不增不减).
  askPrompts:        ['为什么不是 B', '这道题考什么', '类似题再来一题'] as const,
  // PR10 6 轮上限到顶提示 (调性 §1.3 — 不焦虑, 把题做透).
  askRoundLimit:     '这次问得差不多了，先把这题做透，再来下一题。',
  // 意图 chip 标签 (5 类)
  intentWhyWrong:    '为什么错了',
  intentTraps:       '常见错法',
  intentSolvingPath: '解题思路',
  intentCategory:    '题型归类',
  intentFreeform:    '自由问',
  // 输入区
  inputPlaceholder:  '问点什么…',
  send:              '发送',
  sending:           '发送中…',
  stop:              '停止',           // mid-stream cancel button
  // 状态
  emptyTitle:        '从一个问题开始',
  emptyHint:         '选意图，输入问题，提交。系统会基于这道题回答.',
  thinking:          '正在整理回答…',
  // 历史 view (Profile 入口)
  historyTitle:      '我的解析问答',
  historySubtitle:   '过去的对话, 点开继续问.',
  historyEmpty:      '还没有解析问答会话.',
  historyMessageCount: '条消息',
  deleteConfirm:     '确认删除这个会话? 历史不可恢复.',
  delete:            '删除',
  cancel:            '取消',
} as const;

// Slice 2a 申论题 renderer 文案. 调性 §1.3: 不"加油", 不"哎呀". 直接陈述事实.
export const ESSAY_COPY = {
  materialsTitle:    '给定材料',
  materialsExpand:   '展开材料',
  materialsCollapse: '收起材料',
  materialIndex:     (i: number): string => `材料 ${i}`,
  answerLabel:       '作答区',
  answerPlaceholder: '在此作答',
  // 字数提示三档. fmt 函数让 view 直接拼好, 避免 view 里再做条件分支.
  wordCountFmt:      (count: number): string => `${count} 字`,
  wordRangeFmt:      (min: number | undefined, max: number | undefined): string => {
    // 注: !== undefined 而非 truthy — admit min/max=0 时仍当作给了上下限.
    if (min !== undefined && max !== undefined) return `要求 ${min} - ${max} 字`;
    if (max !== undefined) return `不超过 ${max} 字`;
    if (min !== undefined) return `至少 ${min} 字`;
    return '';
  },
  wordCountUnder:    '字数偏少',          // count < min
  wordCountOver:     '字数超出上限',      // count > max
  suggestedTimeFmt:  (mins: number): string => `建议 ${mins} 分钟`,
  fullScoreFmt:      (score: number): string => `满分 ${score} 分`,
} as const;

// Slice 2d 申论批改流程文案 (区别于 ESSAY_COPY 是 renderer 层文案).
// 调性 §1.3: ink-first, 不喊口号, 不拿服务当卖点. 结果异常和对照答案文案
// 要清晰交代"仅供对照, 非官方", 用户对结果心里有数.
export const ESSAY_GRADING_COPY = {
  // 提交按钮 / loading
  submit:                '提交批改',
  submitting:            '提交中…',
  // pending 态 — 通常 1-3 秒返回
  pendingTitle:          '批改中',
  pendingDesc:           '正在批改（长篇稍慢）',
  // 30 秒后还没好的弱提示 (不 abort, 留 fallback). 文案不指定具体路径 —
  // view 层 (EssayGradingPending) 旁边渲 deep link / 「我的申论」入口.
  pendingSlowHint:       '批改较慢, 可关闭此页稍后回来',
  // failed 态
  failedTitle:           '批改失败',
  failedReasonLabel:     '失败原因',
  failedDesc:            '本次批改没有完成, 可重新提交一次.',
  retrySubmit:           '重新提交批改',
  // completed 顶部 banner — 业务层 sanity check 兜底标记
  suspiciousBanner:      '批改结果存在异常, 仅供复盘参考',
  // 5 维度卡 / 总分
  overallScoreLabel:     '成绩',
  overallScoreFmt:       (score: number): string => `${score.toFixed(1)} 分`,
  dimensionScoreFmt:     (score: number): string => `${score.toFixed(1)} / 10`,
  dimensionWeightFmt:    (weight: number): string => `权重 ${(weight * 100).toFixed(0)}%`,
  // 优 / 缺 / 建议 三 list
  strengthsTitle:        '优点',
  weaknessesTitle:       '问题',
  suggestionsTitle:      '建议',
  // 对照答案卡
  sampleAnswerTitle:     '对照答案',
  sampleAnswerBanner:    '仅供对照, 非官方参考答案',
  // 历史页
  historyTitle:          '我的申论',
  historyEmpty:          '还没有批改记录',
  // status badge
  statusPending:         '批改中',
  statusCompleted:       '已完成',
  statusFailed:          '批改失败',
  resultTitle:           '申论批改报告',
  resultInvalidLinkDesc: 'record 链接无效.',
  resultDataErrorTitle:  '批改数据异常',
  resultDataErrorDesc:   'status 为 completed 但 feedback 缺失. 请联系管理员或重新提交批改.',
  resultActionPractice:  '再练一次',
  resultActionPrint:     '打印报告',
  resultActionBack:      '返回我的申论',
  // 整卷模考成绩单 (PR2 EssayExamResults)
  examResultsEyebrow:    'Report · 思考',
  examResultsTitle:      '申论成绩报告',
  examResultsBack:       '返回我的申论',
  examResultsWeightedLabel: '加权得分',
  examResultsWeightedSublabel: '按题目分值加权',
  // 加权得分计算不可能时 (全 pending / 全 fullScore 缺失). 不静默兜底成 1/N.
  examResultsCannotCompute: '部分题缺分值, 加权得分待批改完成后再算',
  // 进度: M / N 题已完成批改
  examResultsProgressFmt: (completed: number, total: number): string =>
    `${completed} / ${total} 题已完成批改`,
  // partial submit (5 题中 M 题成功, N - M 题 POST 失败 / 弃考). 头部红色提示.
  examResultsMissingHint: (submitted: number, total: number): string =>
    `本卷 ${total} 题, ${submitted} 题进入批改; ${total - submitted} 题未提交 (网络失败 / 弃考).`,
  examResultsInvalidLink: '链接无效',
  examResultsInvalidLinkDesc: '整卷成绩单链接缺少题号信息. 请回到「我的申论」从历史记录进入.',
  examResultsRetryFailed: '重新提交此题批改',
} as const;

export const OFFLINE_COPY = {
  banner: '当前离线。已显示最近一次缓存的内容。',
} as const;

// Phase B (auth recovery) 文案. 调性 §1.3: 不打鸡血, 不催, 像图书馆隔壁
// 桌的同学告诉你"链接发了, 一小时内点开就行"。禁用感叹号 / 冲刺 / 加油。
export const AUTH_COPY = {
  // P4 audit P0-3: 认证失败 (401 / 403) 兜底文案. AuthFallbackEmptyState 用.
  // 不打鸡血, 不强制 redirect — 让用户自己点 CTA 回 /login.
  fallback: {
    title: '请先登录',
    description: '登录后即可继续查看此页面.',
  },
  forgot: {
    eyebrow: 'Reset · 思考',
    title: '找回密码',
    subtitle: '输入注册邮箱, 重置链接会发到邮箱',
    emailLabel: '邮箱',
    emailHint: '注册时填的邮箱地址',
    submit: '发送重置链接',
    submitting: '发送中…',
    backToLogin: '返回登录',
    // 后端 D5 silent-200, 不论 email 是否注册都返一样. 文案需中性,
    // 不暴露 user 是否存在.
    successTitle: '已尝试发送',
    successDesc:
      '如果该邮箱注册过账号, 重置链接会发到收件箱。链接 1 小时内有效, 未收到？检查垃圾邮件',
    error: '发送失败, 检查网络后重试',
  },
  reset: {
    eyebrow: 'Reset · 思考',
    title: '重置密码',
    subtitle: '为账号设置新密码, 旧密码立即作废',
    newPasswordLabel: '新密码',
    newPasswordHint: '至少 6 个字符',
    confirmPasswordLabel: '确认密码',
    mismatchError: '密码不一致',
    submit: '确认重置',
    submitting: '重置中…',
    successTitle: '密码已重置',
    successDesc: '可以用新密码登录了',
    // 后端 410 + token_invalid 全部归并成同一文案 (用户视角无差别).
    expiredTitle: '链接已失效',
    expiredDesc: '可能已过期或已使用过, 重新申请一次重置链接吧',
    requestNewLink: '重新申请',
    networkError: '重置失败, 检查网络后重试',
  },
  verify: {
    eyebrow: 'Verify · 思考',
    successTitle: '邮箱已验证',
    successDesc: '已验证',
    failedTitle: '验证链接已失效',
    failedDesc: '可能已过期或已使用过, 在「我的」页重新申请验证邮件',
    backToLogin: '返回登录',
    backToProfile: '查看个人中心',
    // Profile 端文案
    sendButton: '发送验证邮件',
    sendingButton: '发送中…',
    resendButton: '重新发送',
    sentInfo: '验证邮件已发送, 请查收',
    pendingChip: '未验证',
    verifiedChip: '已验证',
  },
  // commit #6i: bind email + bind phone (登录后绑定邮箱/手机, verify-then-write).
  // 跟 register flow 隔离 — bind 必须 logged-in + password 二次确认 (D12).
  bindEmail: {
    sendTitle: '绑定邮箱',
    sendSubtitle: '验证链接发到这个邮箱，10 分钟内点开生效',
    confirmTitle: '确认绑定',
    confirmSubtitle: '输入密码完成邮箱绑定',
    emailLabel: '新邮箱',
    passwordLabel: '当前密码',
    sendButton: '发送验证链接',
    sendingButton: '发送中…',
    confirmButton: '确认绑定',
    confirmingButton: '处理中…',
    sentTitle: '验证邮件已发送',
    sentDesc: '点开邮箱里的链接完成绑定，链接 10 分钟内有效',
    successTitle: '邮箱已绑定',
    successDesc: '可以用新邮箱登录了',
    backToProfile: '返回个人中心',
  },
  bindPhone: {
    title: '绑定手机',
    subtitle: '中国大陆手机号，发码 10 分钟内有效',
    phoneLabel: '新手机号',
    codeLabel: '验证码',
    passwordLabel: '当前密码',
    submitButton: '确认绑定',
    submittingButton: '处理中…',
    successTitle: '手机已绑定',
    successDesc: '可以用新手机号登录了',
    backToProfile: '返回个人中心',
  },
  completeProfile: {
    title: '补全账号信息',
    subtitle: '便于登录和找回，绑定一个邮箱或手机号（旧用户名 90 天后弃用）',
    emailTab: '绑定邮箱',
    phoneTab: '绑定手机',
    skipNote: '稍后再说？右上角可退出登录',
  },
} as const;
