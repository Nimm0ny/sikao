import { MarketingNav } from './Nav';
import { MarketingHero } from './Hero';
import { MarketingPreview } from './Preview';
import { MarketingStats } from './Stats';
import { MarketingHowItWorks } from './HowItWorks';
import { MarketingFeatures } from './Features';
import { MarketingInvite } from './Invite';
import { MarketingPricing } from './Pricing';
import { MarketingFAQ } from './FAQ';
import { MarketingFooter } from './Footer';

// Marketing landing V1 (token-strict, 对齐 element/ui_kits/marketing/index.html).
// 顺序： Nav / Hero / Preview / Stats / How / Features / Invite / Pricing / FAQ / Footer.
// max-width 1440 对齐 claude.com layout. 独立布局 (不走 AppShell) — 登录前不需要 sidebar.
//
// Nav / Stats / Preview 全宽 bleed (sticky / banner 风); 其他 section 在 1440 容器内.

export default function Marketing() {
  return (
    <div data-theme="pure" className="bg-paper-1 text-ink min-h-screen">
      <style>{`
        /* .pv-btn — marketing CTA hover/active 流畅化：
           原型 element/ui_kits/marketing/index.html .btn 的 will-change + active 80ms 行为。
           !important 顶 tailwind duration-base (240ms) 让 active 回弹更利落。 */
        .pv-btn { will-change: transform; }
        .pv-btn:active { transition-duration: 80ms !important; }
      `}</style>
      <MarketingNav />
      <MarketingHero />
      <MarketingPreview />
      <MarketingStats />
      <div className="max-w-[1440px] mx-auto px-8">
        <MarketingHowItWorks />
        <MarketingFeatures />
        <MarketingInvite />
        <MarketingPricing />
        <MarketingFAQ />
        <MarketingFooter />
      </div>
    </div>
  );
}
