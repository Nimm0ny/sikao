import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketingNav } from '../Nav';
import { MarketingFooter } from '../Footer';

/**
 * LegalShell — 法律页通用 chrome (Privacy / Terms / Cookies 共用).
 *
 * 复用 MarketingNav + MarketingFooter, 单列窄容器 (~800px) 适合长文阅读;
 * 顶部面包屑回首页, 头部含标题 + 副标题 + 最后更新日期; 主体 prose 用
 * tailwind token class 渲染, 不引入额外排版插件.
 *
 * 法律文本 v1 草稿 (lhr 2026-05-21 授权): ICP 备案中, 公司主体 / 联系邮箱
 * 与 Footer 对齐. 文本细节后续由律师审核, 当前版本仅满足上线前合规占位.
 */
interface LegalShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly lastUpdated: string;
  readonly children: ReactNode;
}

export function LegalShell({ title, subtitle, lastUpdated, children }: LegalShellProps) {
  return (
    <div data-theme="pure" className="bg-paper-1 text-ink min-h-screen">
      <MarketingNav />
      <main className="max-w-[800px] mx-auto px-5 py-14 sm:px-8 sm:py-20">
        <nav aria-label="面包屑" className="text-xs text-ink-3 mb-5">
          <Link to="/" className="hover:text-ink transition-colors duration-fast ease-motion">
            首页
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{title}</span>
        </nav>
        <header className="mb-10 pb-6 border-b border-line">
          <h1 className="text-3xl font-semibold text-ink mb-3">{title}</h1>
          {subtitle && <p className="text-md text-ink-3 leading-relaxed">{subtitle}</p>}
          <p className="text-xs text-ink-3 mt-4">
            最后更新：<time dateTime={lastUpdated}>{lastUpdated}</time>
          </p>
        </header>
        <article className="text-md text-ink-2 leading-relaxed">{children}</article>
        <div className="mt-14 pt-6 border-t border-line text-sm text-ink-3">
          <p>
            本页是法律文本的 v1 草稿。如对本文条款有任何疑问，请通过{' '}
            <a
              href="mailto:hello@sikao.ai"
              className="text-accent hover:underline underline-offset-2"
            >
              hello@sikao.ai
            </a>{' '}
            联系我们。
          </p>
        </div>
      </main>
      <div className="max-w-[1440px] mx-auto px-8">
        <MarketingFooter />
      </div>
    </div>
  );
}

/** Section heading (h2) — 章节级. */
export function LegalH2({ children }: { readonly children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-ink mt-10 mb-3">{children}</h2>;
}

/** Sub-section heading (h3) — 子条目. */
export function LegalH3({ children }: { readonly children: ReactNode }) {
  return <h3 className="text-md font-semibold text-ink mt-6 mb-2">{children}</h3>;
}

/** Paragraph — 段落, 默认 ink-2 + relaxed leading. */
export function LegalP({ children }: { readonly children: ReactNode }) {
  return <p className="text-md text-ink-2 leading-relaxed mb-4">{children}</p>;
}

/** Unordered list with default list styling. */
export function LegalUl({ children }: { readonly children: ReactNode }) {
  return (
    <ul className="text-md text-ink-2 leading-relaxed mb-4 pl-5 list-disc space-y-2">
      {children}
    </ul>
  );
}
