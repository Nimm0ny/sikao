import { Link } from 'react-router-dom';

// Marketing V1 Hero — 思考 蓝色下划线渐入 + 大 chip + 64px h1 weight 600 balance + 大 CTA hover scale.
// Preview card 已拆到 Preview.tsx (Phase C2). Hero 只剩 chip + h1 + lead + CTAs + meta.

export function MarketingHero() {
  return (
    <header className="max-w-[1440px] mx-auto px-8 pt-24 pb-16">
      <style>{`
        @keyframes mDrawLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .v1-em-react {
          color: var(--accent-1);
          position: relative;
          display: inline-block;
        }
        .v1-em-react::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: 6px;
          height: 4px;
          background: var(--accent-1);
          border-radius: 2px;
          transform: scaleX(0);
          transform-origin: left center;
          animation: mDrawLine 700ms cubic-bezier(0.4, 0, 0.2, 1) 800ms both;
          opacity: .35;
        }
      `}</style>

      <span className="inline-flex items-center gap-3 bg-paper-2 text-ink-1 border border-paper-3 px-5 py-2 rounded-pill text-base font-semibold">
        <i aria-hidden="true" className="w-2 h-2 rounded-pill bg-ink-1" />
        2026 国考大纲已对齐 · 申论批改建议
      </span>

      <h1
        className="mt-6 text-4xl md:text-display font-semibold text-ink max-w-[18ch]"
        style={{ textWrap: 'balance', lineHeight: 'var(--lh-tight)' }}
      >
        让备考从刷题
        <br />
        变成<span className="v1-em-react">思考</span>
      </h1>

      <p
        className="mt-5 text-xl text-ink-3 max-w-[64ch] leading-snug"
        style={{ textWrap: 'pretty' }}
      >
        先做对国考真题。陪你从「为什么错」开始，一题一题想清楚。省考与事业编陆续覆盖。
      </p>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link
          to="/register/email"
          data-testid="marketing-cta-start"
          className="pv-btn inline-flex items-center justify-center gap-2 px-9 py-5 rounded-tiny bg-ink text-white text-lg font-semibold hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] transition-[background-color,transform] duration-base ease-motion"
        >
          开始免费练习
        </Link>
        <a
          href="#preview-section"
          className="pv-btn inline-flex items-center justify-center gap-2 px-9 py-5 rounded-tiny bg-surface border border-line text-ink text-lg font-semibold hover:border-line-3 hover:scale-[1.03] active:scale-[0.98] transition-[border-color,transform] duration-base ease-motion"
        >
          观看 2 分钟演示
        </a>
      </div>

      <div className="mt-6 flex items-center gap-5 text-sm text-ink-3 flex-wrap">
        <span className="before:content-['✓'] before:text-ink-1 before:font-bold before:mr-2">
          受邀者首月免费
        </span>
        <span className="before:content-['✓'] before:text-ink-1 before:font-bold before:mr-2">
          2013–2025 全量真题
        </span>
        <span className="before:content-['✓'] before:text-ink-1 before:font-bold before:mr-2">
          申论批改建议
        </span>
      </div>
    </header>
  );
}
