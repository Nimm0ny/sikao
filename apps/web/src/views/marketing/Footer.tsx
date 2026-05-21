import { Link } from 'react-router-dom';
import { LogoMark } from '@sikao/ui/brand/LogoMark';

// Marketing V1 Footer — 4 列(品牌 / 功能 / 资源 / 关于) + 联系邮箱 + ICP placeholder.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-footer.
//
// 2026-05-21 PR-M1: 法律页落地. 隐私政策 / 服务条款 改 Link 到 /legal/*, 新增
// Cookie 声明; ICP 备案因主体未备案, 显示"备案中"占位文本 (无链接). 资源 / 关于
// 两列其它链接保留 anchor placeholder, 待 P1 帮助中心 / 公众号 / About 落地.

const COLS = [
  {
    title: '功能',
    links: [
      { text: '解析问答', href: '#features-section' },
      { text: '真题刷题与模考', href: '#features-section' },
      { text: '申论评分', href: '#features-section' },
      { text: '错题本与薄弱分析', href: '#features-section' },
    ],
  },
  {
    title: '资源',
    links: [
      { text: '官方公众号', href: '#' },
      { text: '考情动态', href: '#' },
      { text: '备考指南', href: '#' },
      { text: '帮助中心', href: '#' },
    ],
  },
  {
    title: '关于',
    links: [
      { text: '关于我们', href: '#' },
      { text: '联系方式', href: '#' },
      { text: '商务合作', href: '#' },
      { text: '成为导师', href: '#' },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="py-14 pb-10 border-t border-line text-ink-3 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 mb-7">
        <div>
          <div className="font-bold text-ink flex items-center gap-3 mb-3 text-md">
            <LogoMark size={30} />
            思考
          </div>
          <p className="max-w-[280px] leading-snug mb-3">让备考从刷题变成思考。</p>
          <p className="text-xs text-ink-3 leading-snug">
            <span>合作 / 反馈：hello@sikao.ai</span>
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-semibold text-ink mb-4">{col.title}</h4>
            {col.links.map((link) => (
              <a
                key={link.text}
                className="block py-1 hover:text-ink transition-colors duration-fast ease-motion"
                href={link.href}
              >
                {link.text}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="pt-6 border-t border-line flex justify-between flex-wrap gap-3 text-xs">
        <span>
          © 2026 思考科技. 保留所有权利. · <span className="text-ink-3">ICP 备案中</span>
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            className="hover:text-ink transition-colors duration-fast ease-motion"
            to="/legal/privacy"
          >
            隐私政策
          </Link>
          <Link
            className="hover:text-ink transition-colors duration-fast ease-motion"
            to="/legal/terms"
          >
            服务条款
          </Link>
          <Link
            className="hover:text-ink transition-colors duration-fast ease-motion"
            to="/legal/cookies"
          >
            Cookie 声明
          </Link>
        </span>
      </div>
    </footer>
  );
}
