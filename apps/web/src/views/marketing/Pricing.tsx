import { Link } from 'react-router-dom';

// Marketing V1 Pricing — Beta 邀请制 banner + 月/季/年三档 + 折叠对比表 + stagger row reveal.
// 对齐 element/ui_kits/marketing/index.html (V1 落地版) 的 .v1-pricing + .v1-beta-banner +
// .v1-compare-toggle.

interface Plan {
  readonly name: string;
  readonly price: string;
  readonly priceUnit: string;
  readonly desc: string;
  readonly features: readonly string[];
  readonly cta: string;
  readonly featured?: boolean;
}

const PLANS: readonly Plan[] = [
  {
    name: '月度会员',
    price: '¥168',
    priceUnit: '/月',
    desc: '考前一个月内冲刺',
    features: ['解析问答无限次', '全量真题刷题与模考', '申论批改 30 次/月', '错题本 + 考点图谱'],
    cta: '选择月度',
  },
  {
    name: '季度会员',
    price: '¥128',
    priceUnit: '/月',
    desc: '公考备考的标准周期',
    features: ['月度全部权益', '申论批改 60 次/月', '周报数据复盘', '考前 30 天冲刺模式'],
    cta: '选择季度',
    featured: true,
  },
  {
    name: '年度会员',
    price: '¥88',
    priceUnit: '/月',
    desc: '长期备考最划算',
    features: ['季度全部权益', '申论批改不限次', '大纲变更全年随同步'],
    cta: '选择年度',
  },
];

interface CompareRow {
  readonly label: string;
  readonly cells: readonly [string, string, string];
  readonly tones?: readonly ['yes' | 'no' | 'plain', 'yes' | 'no' | 'plain', 'yes' | 'no' | 'plain'];
}

const COMPARE_ROWS: readonly CompareRow[] = [
  {
    label: '解析问答',
    cells: ['不限', '不限', '不限'],
    tones: ['yes', 'yes', 'yes'],
  },
  {
    label: '真题刷题与模考',
    cells: ['全量', '全量', '全量'],
    tones: ['yes', 'yes', 'yes'],
  },
  { label: '错题本 + 考点图谱', cells: ['✓', '✓', '✓'], tones: ['yes', 'yes', 'yes'] },
  {
    label: '申论评分额度',
    cells: ['30 次/月', '60 次/月', '不限'],
    tones: ['plain', 'plain', 'yes'],
  },
  { label: '周报数据复盘', cells: ['—', '✓', '✓'], tones: ['no', 'yes', 'yes'] },
  { label: '考前 30 天冲刺模式', cells: ['—', '✓', '✓'], tones: ['no', 'yes', 'yes'] },
  { label: '大纲变更同步', cells: ['当月', '当季', '全年'], tones: ['plain', 'plain', 'yes'] },
  {
    label: '合计',
    cells: ['¥168', '¥384(¥128/月)', '¥1,056(¥88/月)'],
    tones: ['plain', 'plain', 'plain'],
  },
];

function toneClass(tone: 'yes' | 'no' | 'plain'): string {
  if (tone === 'yes') return 'text-ok font-semibold';
  if (tone === 'no') return 'text-ink-4';
  return 'text-ink-3';
}

export function MarketingPricing() {
  return (
    <section id="pricing-section" className="py-24 border-t border-line">
      <style>{`
        @keyframes pvBetaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(63,126,241,.4); }
          50% { box-shadow: 0 0 0 6px rgba(63,126,241,0); }
        }
        @keyframes pvCmpRowIn {
          from { opacity: 0; transform: translateY(14px); filter: blur(2px); }
          to { opacity: 1; transform: none; filter: blur(0); }
        }
        .pv-beta-badge { animation: pvBetaPulse 1.8s cubic-bezier(0.4,0,0.2,1) 1.2s 2 both; }
        .pv-cmp-toggle[open] > summary > .pv-caret { transform: rotate(180deg); color: var(--ink-1); }
        .pv-cmp-toggle[open] > summary { border-bottom-color: transparent; }
        .pv-cmp-toggle[open] .pv-cmp-row { animation: pvCmpRowIn 560ms cubic-bezier(0.16, 1, 0.3, 1) both; opacity: 0; }
        .pv-cmp-toggle[open] .pv-cmp-row.r0 { animation-delay: 40ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r1 { animation-delay: 100ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r2 { animation-delay: 140ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r3 { animation-delay: 180ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r4 { animation-delay: 220ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r5 { animation-delay: 260ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r6 { animation-delay: 300ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r7 { animation-delay: 340ms; }
        .pv-cmp-toggle[open] .pv-cmp-row.r8 { animation-delay: 380ms; }
      `}</style>

      <div className="mb-12 max-w-[720px]">
        <span className="text-base font-semibold text-ink-1">正式定价 · 预告</span>
        <h2
          className="text-3xl md:text-5xl font-semibold tracking-tighter leading-tight mt-3 mb-4"
          style={{ textWrap: 'balance' }}
        >
          受邀者首月免费，
          <br />
          转正后选一档
        </h2>
        <p className="text-lg text-ink-3 leading-snug">
          邀请制公测期间无费用。下方为转正后预告价，首月退款无理由。
        </p>
      </div>

      {/* Beta banner */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center px-7 py-6 bg-accent text-white rounded-card-lg mb-8">
        <span className="pv-beta-badge inline-flex px-4 py-2 bg-white/15 text-white text-sm font-semibold rounded-pill whitespace-nowrap">
          Beta · 邀请制
        </span>
        <span className="text-md leading-snug text-white/85">
          下方价格仅为正式上线后预告。Beta 期受邀用户{' '}
          <strong className="text-white font-bold">首月免费</strong>
          ，期间随时可退，无任何隐性收费。
        </span>
        <Link
          to="/register/email"
          data-testid="marketing-pricing-cta-apply"
          className="pv-btn inline-flex items-center justify-center gap-2 px-5 py-3 rounded-tiny bg-white text-ink text-md font-semibold hover:bg-paper-2 hover:scale-[1.03] active:scale-[0.98] transition-[background-color,transform] duration-base ease-motion text-center"
        >
          申请获得邀请
        </Link>
      </div>

      {/* 三档卡 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const featured = plan.featured ?? false;
          const cardCls = featured
            ? 'relative bg-accent text-white border border-accent shadow-pop'
            : 'relative bg-surface text-ink border border-line';
          return (
            <div
              key={plan.name}
              className={`${cardCls} rounded-card-lg p-8 flex flex-col gap-3 will-change-transform transition-[transform,box-shadow,border-color] duration-base ease-motion hover:-translate-y-1 hover:shadow-pop hover:border-line-3`}
            >
              {featured && (
                <span className="absolute -top-3 right-5 bg-ink-2 text-white text-sm font-semibold px-3 py-2 rounded-tiny">
                  推荐
                </span>
              )}
              <span
                className={featured ? 'text-md font-semibold text-white/60' : 'text-md font-semibold text-ink-3'}
              >
                {plan.name}
              </span>
              <span className="font-mono text-h-mkt font-bold tracking-tighter leading-none">
                {plan.price}
                <small
                  className={
                    featured
                      ? 'font-sans text-md font-medium text-white/60 ml-1'
                      : 'font-sans text-md font-medium text-ink-3 ml-1'
                  }
                >
                  {plan.priceUnit}
                </small>
              </span>
              <span className={featured ? 'text-sm text-white/70' : 'text-sm text-ink-3'}>
                {plan.desc}
              </span>
              <ul className="list-none p-0 my-4 flex flex-col gap-3 text-md leading-snug">
                {plan.features.map((f) => (
                  <li key={f}>
                    <span
                      className={
                        featured ? 'mr-2 font-bold text-white' : 'mr-2 font-bold text-accent'
                      }
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Link
                  to="/register/email"
                  data-testid={`marketing-pricing-cta-${plan.name}`}
                  className={
                    featured
                      ? 'pv-btn block text-center px-5 py-4 rounded-tiny bg-white text-ink text-md font-semibold hover:bg-paper-2 hover:scale-[1.03] active:scale-[0.98] transition-[background-color,transform] duration-base ease-motion'
                      : 'pv-btn block text-center px-5 py-4 rounded-tiny bg-surface border border-line text-ink text-md font-semibold hover:border-line-3 hover:scale-[1.03] active:scale-[0.98] transition-[border-color,transform] duration-base ease-motion'
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 完整对比表 */}
      <details className="pv-cmp-toggle mt-12">
        <summary className="cursor-pointer list-none px-1 py-6 border-y border-line flex justify-between items-center text-md font-semibold text-ink hover:text-ink-1 transition-colors duration-fast ease-motion">
          查看完整功能对比
          <span className="pv-caret font-mono text-lg text-ink-3 inline-block transition-[transform,color] duration-base ease-motion">
            ▾
          </span>
        </summary>
        <table className="w-full border-collapse text-sm border-b border-line">
          <thead>
            <tr className="pv-cmp-row r0">
              <th className="px-5 py-3 text-left bg-surface-alt font-semibold text-ink w-[32%]">
                功能
              </th>
              <th className="px-5 py-3 text-left bg-surface-alt font-semibold text-ink">
                月度 ¥168
              </th>
              <th className="px-5 py-3 text-left bg-surface-alt font-semibold text-ink">
                季度 ¥128/月 · 推荐
              </th>
              <th className="px-5 py-3 text-left bg-surface-alt font-semibold text-ink">
                年度 ¥88/月
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row, i) => {
              const tones = row.tones ?? (['plain', 'plain', 'plain'] as const);
              return (
                <tr key={row.label} className={`pv-cmp-row r${i + 1} border-b border-line last:border-0`}>
                  <td className="px-5 py-3 text-ink-3">{row.label}</td>
                  <td className={`px-5 py-3 ${toneClass(tones[0])}`}>{row.cells[0]}</td>
                  <td className={`px-5 py-3 ${toneClass(tones[1])}`}>
                    {row.cells[1]}
                  </td>
                  <td className={`px-5 py-3 ${toneClass(tones[2])}`}>{row.cells[2]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </section>
  );
}
