import type { ReactNode } from 'react';
import { Card } from '@sikao/ui/ui';

// Mirrors `Screen: Home -> hero card` in docs/ui-demo/ui-preview.html (§182-202).
// Dumb: caller owns the navigation side-effects; this component only paints
// the hero surface and yields the two CTA slots.
//
// Why slot CTAs instead of (label, onClick) tuples: the demo carries one
// primary + one ghost button, but Home needs to disable "立即开始" while
// papers are still loading and toggle href on "查看全部题库" once the list
// is mounted — easier to express that with a slot than with five extra props.

export interface HomeHeroProps {
  readonly eyebrow: ReactNode;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly primaryCta: ReactNode;
  readonly secondaryCta?: ReactNode;
  readonly className?: string;
}

export function HomeHero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  className,
}: HomeHeroProps) {
  return (
    <Card padding="lg" className={className} data-testid="home-hero">
      <div className="relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          {/* Phase 5.3a: eyebrow 对齐 element/ui_kits/app/index.html §50 —— 灰底 +
              ink 字 + ink 圆点。蓝点缀留给 accent CTA。 */}
          <div className="inline-flex items-center gap-2 text-tiny font-semibold text-ink-1 bg-paper-2 border border-paper-3 px-2 py-1 rounded-pill">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-pill bg-ink-1" />
            {eyebrow}
          </div>
          {/* h2 (非 h1) — page identity 由 view 顶部 PageHeader 承担, hero 是
              组件不是页面 root. 跨 view 一致性 + AT/SEO 不被 hero 动态文案漂移. */}
          <h2 className="mt-4 text-2xl md:text-4xl font-bold tracking-tight leading-tight text-ink">
            {title}
          </h2>
          <p className="mt-3 text-ink-3 leading-relaxed">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
        {/* element spec 保留极淡蓝色 radial 点缀（非纯灰会让 hero 更有呼吸感）。
            md+ 显示避免窄屏裁切。
            PR5a 2026-05-12: 旧 brand blue #3f7ef1 8% → color-mix(--accent-1, 92% transparent)
            走 token SSOT, dark mode 自动切琥珀色 accent. */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-1/3 hidden md:block pointer-events-none"
          style={{
            background:
              'radial-gradient(600px circle at 100% 0%, color-mix(in oklch, var(--accent-1), transparent 92%), transparent 55%)',
          }}
        />
      </div>
    </Card>
  );
}
