import { Link } from 'react-router-dom';
import { LogoMark } from '@sikao/ui/brand/LogoMark';

// Marketing V1 顶栏 — sticky + backdrop-blur + 大字号 nav links + ghost login + primary signup.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-nav-wrap + .v1-nav.

export function MarketingNav() {
  return (
    <div
      className="sticky top-0 z-50 border-b border-line"
      style={{
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
      }}
    >
      <nav className="max-w-[1440px] mx-auto px-5 py-4 sm:px-10 sm:py-5 flex items-center gap-3 sm:gap-8" aria-label="主导航">
        <Link
          to="/"
          className="flex items-center gap-3 font-semibold text-lg text-ink flex-shrink-0"
          data-testid="marketing-nav-brand"
        >
          <LogoMark size={36} />
          <span>思考</span>
        </Link>

        <div className="hidden lg:flex gap-7 ml-3 text-md">
          <a className="text-ink-3 font-medium hover:text-ink transition-colors duration-fast ease-motion" href="#features-section">
            功能
          </a>
          <a className="text-ink-3 font-medium hover:text-ink transition-colors duration-fast ease-motion" href="#preview-section">
            题库
          </a>
          <a className="text-ink-3 font-medium hover:text-ink transition-colors duration-fast ease-motion" href="#pricing-section">
            定价
          </a>
          <a className="text-ink-3 font-medium hover:text-ink transition-colors duration-fast ease-motion" href="#">
            官方公众号
          </a>
        </div>

        <span className="flex-1" />

        <Link
          to="/login"
          data-testid="marketing-cta-login"
          className="pv-btn px-4 py-3 sm:px-5 rounded-tiny border border-line bg-surface text-ink text-sm sm:text-md font-semibold whitespace-nowrap hover:border-line-3 hover:scale-[1.03] active:scale-[0.98] transition-[border-color,transform] duration-base ease-motion"
        >
          登录
        </Link>
        <Link
          to="/register/email"
          data-testid="marketing-cta-signup"
          className="pv-btn px-4 py-3 sm:px-5 rounded-tiny bg-ink text-white text-sm sm:text-md font-semibold whitespace-nowrap hover:bg-ink-1 hover:scale-[1.03] active:scale-[0.98] transition-[background-color,transform] duration-base ease-motion"
        >
          免费试用
        </Link>
      </nav>
    </div>
  );
}
