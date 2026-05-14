/* global React */
// Result wireframes — 答题报告 · marketing SaaS 风（卡片 + 圆角 + 品牌蓝）

// =============================================================
// A：成绩单（环形分数 + 分项条）
// =============================================================
window.ResultA = function ResultA() {
  const score = 78;
  const dash = 2 * Math.PI * 44;
  const offset = dash * (1 - score / 100);
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', padding: '32px 56px', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <span className="sec-title">答题报告</span>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>2024 国考行测 · <span style={{ color: 'var(--brand)' }}>已完成</span></h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>提交于 2026.04.26 22:48 · 用时 1:54:32</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost">分享</button>
          <button className="btn ghost">导出 PDF</button>
          <button className="btn brand">逐题回顾 →</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28, textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-alt)" strokeWidth="6"/>
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 50 50)"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span className="mono" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>{score}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>/ 100</span>
            </div>
          </div>
          <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--brand-50)', borderRadius: 10, color: 'var(--brand-700)', fontSize: 13, fontWeight: 600 }}>
            ↑ 高于 82% 的同期备考者
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div><div style={{ fontSize: 11, color: 'var(--muted)' }}>正确</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>101</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--muted)' }}>错误</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>23</div></div>
            <div><div style={{ fontSize: 11, color: 'var(--muted)' }}>未答</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--muted)' }}>6</div></div>
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>分项准确率</span>
            <span className="chip muted">5 个模块</span>
          </div>
          {[['言语理解', 40, 36, 90], ['判断推理', 35, 29, 82], ['常识判断', 15, 11, 73], ['数量关系', 15, 10, 67], ['资料分析', 25, 15, 60]].map(([n, t, d, p]) => (
            <div key={n} style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{n}</span>
                <span><span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{d}/{t}</span><span className="mono" style={{ marginLeft: 12, fontSize: 16, fontWeight: 700, color: p < 70 ? 'var(--danger)' : 'var(--ink)' }}>{p}%</span></span>
              </div>
              <div className="bar"><i style={{ width: `${p}%`, background: p < 70 ? 'var(--danger)' : 'var(--brand)' }}/></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        {[
          { t: '强项', n: '言语 · 片段阅读', m: '准确率 95%', good: true },
          { t: '需巩固', n: '资料分析 · 增长率', m: '错 6 题 / 12', good: false },
          { t: '建议', n: '速算专项 · 30 题', m: 'AI 推荐', cta: true },
        ].map((c, i) => (
          <div key={i} className="card" style={{ padding: 18, background: c.cta ? 'var(--ink)' : 'var(--bg)', color: c.cta ? '#fff' : 'var(--ink)', border: c.cta ? 'none' : '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: c.cta ? .6 : 1, color: c.cta ? '#fff' : (c.good ? 'var(--success)' : 'var(--warn)'), textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.t}</div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 4px' }}>{c.n}</div>
            <div style={{ fontSize: 12, opacity: .7, marginBottom: c.cta ? 12 : 0 }}>{c.m}</div>
            {c.cta && <button className="btn brand" style={{ marginTop: 4 }}>开始专项 →</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================
// B：仪表盘风
// =============================================================
window.ResultB = function ResultB() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gridTemplateRows: 'auto auto 1fr', gap: 12 }}>
      <div className="card" style={{ gridColumn: '1 / 5', padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="sec-title">报告</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>2024 国考行测 · <span style={{ color: 'var(--brand)' }}>78 / 100</span></h2>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          {[['用时', '1:54:32'], ['超过', '82%'], ['错题', '23'], ['正确率', '78%']].map(([l, v]) => (
            <div key={l} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>分项雷达</div>
        <div className="ph" style={{ height: 200, marginTop: 10 }}>radar chart · 5 维</div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>每题用时</div>
        <div className="ph" style={{ height: 200, marginTop: 10 }}>柱状图 · 130 题</div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>同侪分布</div>
        <div className="ph" style={{ height: 200, marginTop: 10 }}>分数曲线 · 你 P82</div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>准确率走势</div>
        <div className="ph" style={{ height: 200, marginTop: 10 }}>近 10 次模考</div>
      </div>

      <div className="card" style={{ gridColumn: '1 / 4', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>知识点掌握度热力</span>
          <span className="chip muted">42 个考点</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4 }}>
          {Array.from({ length: 42 }).map((_, i) => {
            const v = Math.random();
            const bg = v > .7 ? 'var(--success)' : v > .5 ? '#86efac' : v > .3 ? 'var(--warn-bg)' : 'var(--danger-bg)';
            return <div key={i} style={{ aspectRatio: '1', background: bg, borderRadius: 4 }}/>;
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 18, background: 'var(--ink)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>AI 建议</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, margin: '10px 0 14px', flex: 1 }}>
          资料分析正确率 60% — 主要失分点在<strong style={{ color: '#60a5fa' }}>增长率/比重</strong>，建议 30 题速算专项。
        </div>
        <button className="btn brand" style={{ width: '100%', justifyContent: 'center' }}>开始专项 →</button>
      </div>
    </div>
  );
};

// =============================================================
// C：时间轴回顾
// =============================================================
window.ResultC = function ResultC() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', padding: '32px 56px', overflow: 'auto' }}>
      <span className="sec-title">报告 · 时间轴</span>
      <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>1 小时 54 分钟，<span style={{ color: 'var(--danger)' }}>23 道错题</span></h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>每条 = 一道题；长度 = 用时；颜色 = 对错</p>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 11, color: 'var(--muted)' }} className="mono">
          <span>00:00</span><span>1:54:32</span>
        </div>
        <div style={{ height: 56, position: 'relative', background: 'var(--bg-alt)', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
          {Array.from({ length: 130 }).map((_, i) => {
            const wrong = [3, 7, 12, 18, 22, 28, 33, 42, 48, 55, 61, 67, 72, 78, 83, 89, 94, 100, 105, 111, 117, 122, 127].includes(i);
            const w = 0.5 + Math.random() * 1.5;
            return <div key={i} style={{ flex: w, height: '100%', background: wrong ? 'var(--danger)' : 'var(--brand)', opacity: wrong ? 1 : .85 }}/>;
          })}
        </div>
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          <span>言语 1-40</span><span>判断 41-75</span><span>常识 76-90</span><span>数量 91-105</span><span>资料 106-130</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>用时最久 · TOP 5</span>
            <span className="chip muted">超 3 分钟标红</span>
          </div>
          {[['#42 · 言语 · 片段阅读', '4:12', true], ['#118 · 资料 · 增长率', '3:58', true], ['#103 · 数量 · 行程', '3:42', true], ['#67 · 判断 · 类比', '2:50', false], ['#125 · 资料 · 比重', '2:44', false]].map(([t, d, hot]) => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
              <span>{t}</span>
              <span className="mono" style={{ color: hot ? 'var(--danger)' : 'var(--ink)', fontWeight: 600 }}>{d}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>错题集中 · 知识点</span>
            <button className="btn ghost tiny">全部 →</button>
          </div>
          {[['资料分析 · 增长率', 6], ['资料分析 · 比重', 4], ['判断推理 · 类比', 4], ['数量 · 行程问题', 3], ['言语 · 选词填空', 3]].map(([k, n]) => (
            <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ fontWeight: 500 }}>{k}</span>
                <span className="mono" style={{ color: 'var(--danger)', fontWeight: 700 }}>×{n}</span>
              </div>
              <div className="bar"><i style={{ width: `${n / 6 * 100}%`, background: 'var(--danger)' }}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
