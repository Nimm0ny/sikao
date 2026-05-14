import { Link } from 'react-router-dom';

// Marketing V1 Beta 公测首发邀请 — 替代旧 Testimonials.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-invite.
// 诚实风：Beta 阶段不伪造学员故事，改成邀请用户给反馈。

export function MarketingInvite() {
  return (
    <section className="py-24 border-t border-line">
      <div className="bg-paper-2 border border-paper-3 rounded-card-lg p-14 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 items-center">
        <div>
          <span className="text-base font-semibold text-ink-1">Beta 公测 · 首发邀请</span>
          <h2
            className="text-h-mkt font-semibold leading-tight tracking-tighter mt-3 mb-4"
            style={{ textWrap: 'balance' }}
          >
            我们刚开始。
            <br />
            你可以是第一个。
          </h2>
          <p
            className="text-lg text-ink-3 leading-snug max-w-[60ch]"
            style={{ textWrap: 'pretty' }}
          >
            思考目前是公开测试。解析还会答错，错题归类还会归错。比起赞美，我们更想听到「这里你答错了」—— 你的反馈会直接决定下个版本怎么做。
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            to="/register/email"
            data-testid="marketing-invite-cta-apply"
            className="pv-btn inline-flex items-center justify-center gap-2 px-9 py-5 rounded-tiny bg-ink text-white text-lg font-semibold hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] transition-[background-color,transform] duration-base ease-motion text-center"
          >
            申请加入 beta
          </Link>
          <a
            href="mailto:hello@sikao.ai"
            data-testid="marketing-invite-cta-feedback"
            className="pv-btn inline-flex items-center justify-center gap-2 px-9 py-5 rounded-tiny bg-surface border border-line text-ink text-lg font-semibold hover:border-line-3 hover:scale-[1.03] active:scale-[0.98] transition-[border-color,transform] duration-base ease-motion text-center"
          >
            提交反馈
          </a>
        </div>
      </div>
    </section>
  );
}
