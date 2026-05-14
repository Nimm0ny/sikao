/* global React */
// PracticeStart wireframes — 与 marketing 对齐：圆角 + 品牌蓝 + Inter + 卡片
// 复用 dashboard.jsx 的 Shell（Sidebar+Topbar）
const Shell = window.Shell;

// A：分步 stepper
window.StartA = function StartA() {
  const steps = ['模块', '题量', '难度', '开始'];
  const cur = 1;
  return (
    <Shell active="题库">
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <span className="sec-title">新建练习</span>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>选择 <span style={{ color: 'var(--brand)' }}>题量</span></h1>

        {/* stepper */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, alignItems: 'center' }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: i < cur ? 'var(--success)' : (i === cur ? 'var(--brand)' : 'var(--bg-alt)'),
                  color: i <= cur ? '#fff' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  border: i === cur ? '4px solid var(--brand-100)' : 'none',
                }}>
                  {i < cur ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: i === cur ? 700 : 500, color: i <= cur ? 'var(--ink)' : 'var(--muted)' }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--line)', margin: '0 12px' }}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { n: 10, t: '快速', d: '10 分钟', desc: '碎片时间' },
            { n: 30, t: '常规', d: '30 分钟', desc: '一节自习', sel: true },
            { n: 60, t: '强化', d: '60 分钟', desc: '深度训练' },
            { n: 130, t: '整套', d: '120 分钟', desc: '完整模考' },
          ].map(c => (
            <div key={c.n} className="card" style={{
              padding: 20, cursor: 'pointer',
              borderColor: c.sel ? 'var(--brand)' : 'var(--line)',
              borderWidth: c.sel ? 2 : 1,
              background: c.sel ? 'var(--brand-50)' : 'var(--bg)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="chip" style={{ background: c.sel ? 'var(--brand)' : 'var(--bg-alt)', color: c.sel ? '#fff' : 'var(--muted)', borderColor: 'transparent' }}>{c.t}</span>
                {c.sel && <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--brand)"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 12 }} className="mono">{c.n}<span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 4 }}>题</span></div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.d}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <button className="btn ghost">← 上一步</button>
          <button className="btn brand">下一步 →</button>
        </div>
      </div>
    </Shell>
  );
};

// B：单页全配置
window.StartB = function StartB() {
  return (
    <Shell active="题库">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div>
          <span className="sec-title">新建练习</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '4px 0 24px' }}>设置训练配方</h1>

          {[
            { k: '模块', opts: ['言语', '判断', '常识', '数量', '资料', '申论', '全部'], sel: [0, 1, 3, 4] },
            { k: '难度', opts: ['基础', '进阶', '真题', '压轴'], sel: [2] },
            { k: '来源', opts: ['国考', '省考·浙江', '省考·广东', '事业单位', '专项'], sel: [0, 1] },
            { k: '题型', opts: ['单选', '多选', '判断', '材料题'], sel: [0, 3] },
          ].map(g => (
            <div key={g.k} className="card" style={{ padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{g.k}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.opts.map((o, i) => {
                  const on = g.sel.includes(i);
                  return <span key={o} style={{
                    padding: '7px 14px', borderRadius: 8,
                    border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                    background: on ? 'var(--brand-50)' : 'var(--bg)',
                    color: on ? 'var(--brand-700)' : 'var(--ink-muted)',
                    fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer',
                  }}>{o}</span>;
                })}
              </div>
            </div>
          ))}

          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>题量</span>
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>30</span>
            </div>
            <div style={{ height: 6, background: 'var(--brand-50)', borderRadius: 3, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '23%', background: 'var(--brand)', borderRadius: 3 }}/>
              <div style={{ position: 'absolute', left: '23%', top: -7, width: 20, height: 20, borderRadius: '50%', background: '#fff', border: '2px solid var(--brand)', transform: 'translateX(-10px)', boxShadow: 'var(--shadow-card)' }}/>
            </div>
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
              <span>10</span><span>30</span><span>60</span><span>100</span><span>130</span>
            </div>
          </div>
        </div>

        <aside style={{ position: 'sticky', top: 0 }}>
          <div className="card" style={{ padding: 24 }}>
            <span className="sec-title">摘要</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, margin: '8px 0 16px' }}>
              <span style={{ color: 'var(--brand)' }}>30 题</span> · 真题难度<br/>国考 + 浙江省考
            </h3>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              {[['题量', '30'], ['预计用时', '30 分钟'], ['含材料题', '是'], ['计时模式', '倒计时']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>{l}</span>
                  <span className="mono" style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <button className="btn brand" style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '12px' }}>开始练习 →</button>
            <button className="btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px' }}>保存为模板</button>
          </div>
        </aside>
      </div>
    </Shell>
  );
};

// C：跳出常规 — 卡牌式（像点菜）
window.StartC = function StartC() {
  const cards = [
    { tag: '推荐', n: '资料分析 · 速算专项', sub: '30 题 · 30 分钟', meta: '弱项突破', accent: true, icon: '🎯' },
    { tag: '续做', n: '2024 国考行测', sub: '剩 88 题 · ~80 分钟', meta: '昨晚 ↪ 第 42 题' },
    { tag: '错题', n: '错题回顾', sub: '14 题 · 15 分钟', meta: '昨日新增' },
    { tag: '主题', n: '言语 · 近义辨析', sub: '20 题 · 高频考点', meta: '近 5 年 11 次' },
    { tag: '主题', n: '判断 · 类比推理', sub: '25 题 · ~25 分钟', meta: '上次 70%' },
    { tag: '模板', n: '我的晨练', sub: '20 题 · 言语+常识', meta: '自定义' },
    { tag: '模考', n: '行测整套 · 国考 2023', sub: '130 题 · 120 分钟', meta: '完整模考' },
    { tag: '申论', n: '申论一篇 · AI 批改', sub: '~40 分钟', meta: '副省级' },
  ];
  return (
    <Shell active="题库">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <span className="sec-title">今日推荐</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>挑一份开始练</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>点击卡片直接开始；勾选多张可组合成套餐。</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['全部', '主题', '续做', '模考', '错题'].map((t, i) => (
            <button key={t} className="btn tiny" style={{
              background: i === 0 ? 'var(--ink)' : 'transparent',
              color: i === 0 ? '#fff' : 'var(--muted)',
              border: i === 0 ? 'none' : '1px solid var(--line)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
        {cards.map((c, i) => (
          <div key={i} className="card hover" style={{
            padding: 22, position: 'relative', minHeight: 180, cursor: 'pointer',
            background: c.accent ? 'var(--ink)' : 'var(--bg)',
            color: c.accent ? '#fff' : 'var(--ink)',
            border: c.accent ? 'none' : '1px solid var(--line)',
            boxShadow: c.accent ? 'var(--shadow-pop)' : 'var(--shadow-card)',
            overflow: 'hidden',
          }}>
            {c.accent && <div style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, background: 'radial-gradient(circle, rgba(59,130,246,.4), transparent 60%)' }}/>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
              <span className="chip" style={{
                background: c.accent ? 'rgba(59,130,246,.2)' : 'var(--brand-50)',
                color: c.accent ? '#93c5fd' : 'var(--brand-700)',
                borderColor: c.accent ? 'rgba(59,130,246,.3)' : 'var(--brand-100)',
              }}>{c.tag}</span>
              <input type="checkbox" style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}/>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, margin: '14px 0 6px', position: 'relative' }}>{c.n}</div>
            <div style={{ fontSize: 13, opacity: .75, marginBottom: 16, position: 'relative' }}>{c.sub}</div>
            <div style={{ position: 'absolute', bottom: 14, left: 22, right: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${c.accent ? 'rgba(255,255,255,.15)' : 'var(--line)'}`, fontSize: 12 }}>
              <span style={{ opacity: .65 }}>{c.meta}</span>
              <span style={{ fontWeight: 600, color: c.accent ? '#60a5fa' : 'var(--brand)' }}>开始 →</span>
            </div>
          </div>
        ))}
      </div>

      {/* 底部组合栏 */}
      <div style={{ marginTop: 28, padding: '14px 20px', background: 'var(--ink)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="chip" style={{ background: 'rgba(59,130,246,.2)', color: '#93c5fd', borderColor: 'transparent' }}>0 项已选</span>
          <span style={{ fontSize: 13, opacity: .7 }}>勾选多张组合成套餐</span>
        </div>
        <button className="btn brand">开始套餐 →</button>
      </div>
    </Shell>
  );
};
