// Marketing V1 三步使用流程 + accent dashed connector 贯穿 step 1 → step 3.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-how + 考前冲刺副文.

const STEPS = [
  {
    n: 1,
    title: '告诉我们你的考试',
    desc: '选择目标 —— 国考 / 省考 / 事业编，告诉我们考试时间。思考会生成一份专属复习计划。',
    hint: null,
  },
  {
    n: 2,
    title: '按计划练习，随时提问',
    desc: '刷真题，遇到卡壳的题直接追问解析。它记得你的错题，知道你哪里弱。',
    hint: null,
  },
  {
    n: 3,
    title: '周报复盘，考前冲刺',
    desc: '每周拿到一份数据报告，看清进步曲线。薄弱模块自动加码训练。',
    hint: '考前 30 天自动切换冲刺模式 · 真题压轴 + 错题重做。',
  },
] as const;

export function MarketingHowItWorks() {
  return (
    <section className="py-24 border-t border-line overflow-x-hidden">
      <span className="text-base font-semibold text-ink-1">使用方式</span>
      <h2
        className="text-3xl md:text-5xl font-semibold tracking-tighter leading-tight mt-3 mb-4 max-w-[720px]"
        style={{ textWrap: 'balance' }}
      >
        三步开始你的备考
      </h2>
      <p className="text-lg text-ink-3 leading-snug max-w-[56ch]">
        告诉思考你的考试，按计划练习，周报复盘。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 relative">
        {/* accent 蓝 dashed connector V6 — 整体缩短 + 两端 fade 渐变。
           V5 (各端 -200px) 用户反馈太长, 缩短 60% → 各端 -80px (跟 V2 几何一致, viewport 视觉
           仍对称因 grid 居中 in viewport). conn 总宽 = grid.w + 160 = 1536px.
           V6 加 mask-image 让两端透明 fade out (0~80px / (100%-80px)~100% 区间), 渐变效果让虚线
           不再硬切, 视觉更柔和精致. fade 区 80px ≈ conn 16% 总宽, 平滑过渡圆球贯穿区. */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-5 h-0.5 z-0"
          style={{
            left: '-80px',
            right: '-80px',
            background:
              'repeating-linear-gradient(90deg, var(--accent-1) 0 8px, transparent 8px 14px)',
            opacity: 0.4,
            maskImage:
              'linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)',
          }}
        />
        {STEPS.map((step) => (
          <div key={step.n} className="relative z-10">
            <div className="w-10 h-10 rounded-pill bg-ink text-white font-bold tabular-nums font-mono flex items-center justify-center text-md border-4 border-surface mb-5">
              {step.n}
            </div>
            <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
            <p className="text-md text-ink-3 leading-relaxed">{step.desc}</p>
            {step.hint && (
              <p className="text-sm text-accent mt-2 leading-relaxed">{step.hint}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
