// Marketing V1 FAQ — 6 题 details/summary + body fade.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-faq.

const FAQS = [
  {
    q: '解析问答会不会答错？',
    a: '思考目前是公开测试，解析偶有答错。我们会清晰标注答案把握度，每周复盘错误样例并迭代。如果你发现错误归类或解析，可以一键反馈 — 这是我们最珍惜的输入。',
  },
  {
    q: '零基础裸考能用吗？',
    a: '可以。建议从解析问答入手 —— 先搞清楚每道真题背后的考点，再按系统推荐的顺序刷题。错题会自动归类，你不会被动重复练同类的题。',
  },
  {
    q: '和粉笔 / 华图等传统题库有什么不同？',
    a: '我们不只是更便宜的题库。核心区别是：你做错题时，解析讲清「为什么错」，而不只给标准答案。错题自动归到考点图谱，你能看到自己的薄弱模块，而不是被海量题淹没。',
  },
  {
    q: '申论批改对齐什么评分标准？',
    a: '对齐近 5 年国考阅卷的 5 个维度：扣题、要点、结构、表达、卷面。批改报告逐维度给分 + 改进建议，30 秒内出结果。批改与人工评分的对齐数据我们会持续公开。',
  },
  {
    q: '怎么退款？',
    a: 'Beta 期受邀者首月免费，期间可随时退出。正式付费后，首月内可申请全额退款，无需理由。年度会员超出首月的部分按月退还剩余金额。',
  },
  {
    q: '省考 / 事业编现在能用吗？',
    a: '国考真题已全量对齐；省考与事业编正在分批上线，可在邀请申请里注明你的优先地区，我们按真实需求排期。',
  },
] as const;

export function MarketingFAQ() {
  return (
    <section className="py-24 border-t border-line">
      <style>{`
        @keyframes faqFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .faq-body { animation: faqFadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      `}</style>

      <div className="mb-12 max-w-[720px]">
        <span className="text-base font-semibold text-ink-1">常见问题</span>
        <h2
          className="text-3xl md:text-5xl font-semibold tracking-tighter leading-tight mt-3 mb-4"
          style={{ textWrap: 'balance' }}
        >
          你想问的，我们都答了
        </h2>
        <p className="text-lg text-ink-3 leading-snug">
          还有疑问发到{' '}
          <a
            href="mailto:hello@sikao.ai"
            className="text-accent hover:underline"
          >
            hello@sikao.ai
          </a>
          ，我们 24 小时内回复。
        </p>
      </div>

      <div className="flex flex-col">
        {FAQS.map((item, idx) => (
          <details
            key={item.q}
            className="border-b border-line py-5 group [&:first-child]:border-t [&[open]>summary]:text-ink-1 [&[open]>summary>span]:rotate-180 [&[open]>summary>span]:text-ink-1"
          >
            <summary
              className="cursor-pointer list-none flex items-center justify-between gap-4 text-lg font-medium text-ink hover:text-ink-1 transition-colors duration-fast ease-motion"
              data-testid={`marketing-faq-q-${idx}`}
            >
              {item.q}
              <span className="text-xl text-ink-3 font-mono inline-block transition-transform duration-base ease-motion">
                ▾
              </span>
            </summary>
            <p className="faq-body text-md text-ink-3 leading-relaxed mt-3 pr-9">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
