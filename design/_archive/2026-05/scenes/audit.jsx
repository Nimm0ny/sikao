/* global React */
const { useState } = React;

// 盘点页：项目现状 + 缺失清单
window.AuditOverview = function AuditOverview() {
  const have = [
    { k: 'Tokens', v: 'colors_and_type.css · 完整的色板/字号/圆角/阴影/动画时长' },
    { k: 'UI 原子', v: 'Button / Card / Tab / Badge / Drawer / Modal / EmptyState / Skeleton / FormField / OptionRow / AnswerCell / ScoreRing / ProgressBar / PipeNav' },
    { k: 'Dashboard', v: 'MetricCards / Heatmap / KnowledgeBubble / TrendLine / RecentExamsList / RecentWrongQuestions' },
    { k: 'Practice', v: 'AnswerCardGrid / ExitConfirmModal / SubTopBar / SessionContent / SubmitDrawerHeader' },
    { k: 'Result', v: 'ResultHero / AnswerComparisonGrid / SectionAccuracyCard / WrongReviewCard' },
    { k: 'WrongBook', v: 'Filters / List / Card / Detail' },
    { k: 'Views', v: 'Login / Home / Dashboard / PracticeStart / PracticeSession / Result / WrongBook / Health' },
    { k: 'UI Kits', v: 'app · marketing · mobile（marketing 还很空）' },
  ];
  const missing = [
    { tag: 'PAGES', items: [
      '答题报告详情（深度分析 / 逐题回顾 / 同侪对比）',
      '错题本筛选高级模式 + 批量复习流',
      '个人中心 / 资料编辑',
      '设置（账号 / 偏好 / 通知 / 数据 / 订阅）',
      '注册 + 找回密码 + 邮箱验证',
      '考试日历 / 倒计时',
      '学习计划生成器',
      'AI 答疑会话',
      '申论批改详情页',
      '订阅升级 / 计费',
      '搜索结果页',
      '空态 / 404 / 网络错误',
    ]},
    { tag: 'COMPONENTS', items: [
      '多选题 Renderer（目前只有 SingleChoice）',
      '判断题 Renderer',
      '材料题分栏（左材料右题）容器变体',
      '数量关系 / 资料分析 表格 + 图表渲染',
      '图形推理 image picker',
      '计时器（倒计时 + 暂停 + 提交临界）',
      '音频/视频播放（听力题预留）',
      '答题中底部抽屉（答题卡 / 笔记 / 标记原因）',
      '通知 Toast / Banner',
      '步骤条 Stepper（用于 PracticeStart 多步选项）',
      '日历 / DateRange picker',
      '富文本笔记编辑器',
      '引导气泡 Coachmark',
    ]},
    { tag: 'SYSTEM', items: [
      'Motion 规范（已有 MOTION.md，但未落地到具体场景动画）',
      'Empty state 库（不同场景 8+ 种插画位）',
      'Loading / Skeleton 矩阵（按页面）',
      '错误态 / 重试态 / 离线态',
      '可访问性：键盘焦点环 / 屏幕阅读器标签',
      '深色模式：tokens 有了，但页面没系统化适配',
      'Density：紧凑 / 默认 / 舒适',
      '打印样式（错题本 PDF 导出）',
    ]},
    { tag: 'MARKETING', items: [
      '落地首页（产品介绍 + Hero + 特性 + 价格 + FAQ）',
      '功能详情页 × 4（题库 / AI 答疑 / 申论批改 / 数据分析）',
      '价格页',
      '关于 / 联系',
      '博客 / 备考心得',
      'SEO meta + OG 图模板',
    ]},
    { tag: 'MOBILE', items: [
      '所有核心页的 H5 / iOS 适配（目前只有桌面）',
      '底栏 TabBar 导航',
      '答题中触摸优化（手势翻页 / 长按标记）',
      '离线模式 / 弱网降级',
    ]},
  ];

  return (
    <div style={{ width: 1280, padding: '40px 56px', background: 'var(--cream)', color: 'var(--ink)', fontFamily: 'var(--sans)', minHeight: 760 }}>
      <div className="eyebrow accent" style={{ marginBottom: 8 }}>SIKAO · DESIGN AUDIT · 2026.04</div>
      <h1 className="serif" style={{ fontSize: 56, margin: '0 0 8px', fontWeight: 400, letterSpacing: '-0.02em' }}>
        盘点 <em>「思考」</em>缺失元素
      </h1>
      <p style={{ color: 'var(--ink-muted)', maxWidth: 720, margin: '0 0 28px', fontSize: 15, lineHeight: 1.6 }}>
        基于 <span className="mono">frontend/src</span>、<span className="mono">element/preview</span>、<span className="mono">element/ui_kits</span> 的实际产出做了一遍交叉对比。下面分 5 类列出当前缺口；右下方的 wireframe 区按这份清单展开。
      </p>

      <hr className="rule-strong" style={{ marginBottom: 24 }}/>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>已有 · IN STOCK</div>
          {have.map((h, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--placeholder)', marginBottom: 4 }}>{h.k}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>{h.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {missing.map((g, gi) => (
            <div key={gi}>
              <div className="eyebrow" style={{ color: 'var(--danger)', marginBottom: 10 }}>缺 · {g.tag}</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {g.items.map((it, i) => (
                  <li key={i} style={{
                    display: 'flex', gap: 12, padding: '8px 0',
                    borderBottom: '1px dashed var(--line)',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    <span className="mono" style={{ color: 'var(--placeholder)', width: 22 }}>{String(i+1).padStart(2,'0')}</span>
                    <span style={{ color: 'var(--ink)' }}>{it}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 36, padding: 20, border: '1px solid var(--ink)', background: 'var(--bg)' }}>
        <div className="eyebrow ink" style={{ marginBottom: 8 }}>下面要做什么</div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.4 }}>
          每个场景用 <em>3–6</em> 个 wireframe 探索方向 — 左下角 <span className="mono" style={{ fontSize: 14 }}>Tweaks</span> 可切换深浅色 / 答题状态 / 桌面 vs 移动 / 手绘风。
        </div>
      </div>
    </div>
  );
};
