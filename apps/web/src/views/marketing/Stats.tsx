import { useEffect, useRef } from 'react';

// Marketing V1 Stats — 760+ / 88,000+ / 13,IntersectionObserver 进入视口时数字从 0 滚到 target.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-stats + count-up.
// 数据口径见 memory `project_xingce_import_pg_v1_done.md` (762 papers / 88,569 questions).

// 数值 (target) 走 count-up animation, 量词 (unit) 跟数值 baseline 对齐 inline,
// label 在第二行作描述。用户反馈：量词跟数值同行，不再单独占第二行开头。
const STATS = [
  { target: '760+', unit: '套', label: '真题 · 国考 / 省考 / 事业编' },
  { target: '88,000+', unit: '道', label: '已解析题目' },
  { target: '13', unit: '年', label: '真题覆盖 · 2013–2025' },
] as const;

function animateCountUp(el: HTMLElement, target: string): void {
  const isPlus = target.endsWith('+');
  const cleaned = target.replace(/[+,]/g, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    el.textContent = target;
    return;
  }
  const start = performance.now();
  const dur = 1200;
  const tick = (t: number): void => {
    const p = Math.min(1, (t - start) / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = Math.round(num * ease);
    el.textContent = val.toLocaleString() + (isPlus ? '+' : '');
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

export function MarketingStats() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const triggered = new Set<HTMLDivElement>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLDivElement;
          if (triggered.has(el)) continue;
          triggered.add(el);
          const idx = refs.current.indexOf(el);
          if (idx < 0) continue;
          const targetStr = STATS[idx].target;
          el.textContent = targetStr.endsWith('+') ? '0+' : '0';
          animateCountUp(el, targetStr);
          obs.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    refs.current.forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <section className="max-w-[1440px] mx-auto px-8 mt-24 py-20 border-t border-line grid grid-cols-1 md:grid-cols-3 gap-10">
      {STATS.map((s, i) => (
        <div key={s.label}>
          <div className="flex items-baseline gap-2">
            <div
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="font-mono text-4xl font-bold text-ink tabular-nums"
              data-testid={`marketing-stat-${i}`}
            >
              {s.target}
            </div>
            <span className="font-sans text-xl font-medium text-ink-3">{s.unit}</span>
          </div>
          <div className="text-sm text-ink-3 mt-1">{s.label}</div>
        </div>
      ))}
    </section>
  );
}
