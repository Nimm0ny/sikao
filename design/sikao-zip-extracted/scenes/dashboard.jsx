/* global React */
// Dashboard wireframes — 6 个方向，对齐 marketing SaaS 风
// 圆角 + 品牌蓝 + Inter + 卡片阴影 + icon-sq + chip + ✓ 列表

const Sidebar = ({ active = '首页' }) => (
  <aside style={{
    width: 220, background: 'var(--sidebar)', color: '#94a3b8',
    padding: '22px 14px', fontSize: 13, flexShrink: 0,
  }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, color:'#fff', fontWeight: 700, padding: '4px 10px 28px', fontSize: 17 }}>
      <div style={{ width:28, height:28, borderRadius: 8, background:'var(--brand)', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: 13 }}>思</div>
      思考
    </div>
    {[
      ['首页','M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
      ['题库','M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
      ['AI 答疑','M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
      ['申论批改','M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6'],
      ['学习计划','M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
      ['错题本','M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
      ['数据分析','M3 3v18h18M19 9l-5 5-4-4-3 3'],
      ['设置','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
    ].map(([x, p]) => (
      <div key={x} style={{
        display:'flex', alignItems:'center', gap:10,
        padding: '9px 12px', borderRadius: 8, marginBottom: 2,
        background: x === active ? 'rgba(37,99,235,.18)' : 'transparent',
        color: x === active ? '#fff' : '#94a3b8',
        fontWeight: x === active ? 600 : 500,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p}/></svg>
        {x}
      </div>
    ))}
    <div style={{ marginTop: 24, padding: 14, background: 'rgba(37,99,235,.12)', borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, letterSpacing: '.05em' }}>季度会员</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, lineHeight: 1.5 }}>剩 71 天 · AI 答疑无限</div>
    </div>
  </aside>
);

const Topbar = ({ user = '李思源' }) => (
  <div style={{
    height: 64, padding: '0 32px', display: 'flex', alignItems: 'center', gap: 16,
    background: 'var(--paper)', borderBottom: '1px solid var(--line)',
  }}>
    <div style={{ flex: 1, position: 'relative', maxWidth: 480 }}>
      <input style={{
        width: '100%', padding: '9px 14px 9px 38px', borderRadius: 10,
        border: '1px solid var(--line)', background: 'var(--bg-alt)',
        fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
      }} placeholder="搜真题、考点、错题…"/>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: 12 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    </div>
    <div style={{ flex: 1 }}/>
    <span className="chip muted">距 2026 国考 · 197 天</span>
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{user[0]}</div>
  </div>
);

window.Sidebar = Sidebar;
window.Topbar = Topbar;
const Shell = ({ active, children }) => (
  <div style={{ width: 1280, height: 800, display: 'flex', background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', overflow: 'hidden' }}>
    <Sidebar active={active}/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar/>
      <main style={{ flex: 1, padding: 28, overflow: 'auto' }}>{children}</main>
    </div>
  </div>
);

// 共享：紧凑 metric 卡
const Metric = ({ label, value, delta, hint, accent }) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }} className="mono">{value}</span>
      {delta && <span style={{ fontSize: 12, fontWeight: 600, color: accent === 'down' ? 'var(--danger)' : 'var(--success)' }}>{delta}</span>}
    </div>
    {hint && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
  </div>
);

// =============================================================
// 方案 A：欢迎卡 + 继续学习 hero + 数据网格（最贴近 marketing 默认）
// =============================================================
window.DashA = function DashA() {
  return (
    <Shell active="首页">
      {/* hero 卡片：渐变光晕 + eyebrow + 大标题 + CTA */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'var(--paper)', border: '1px solid var(--line)',
        borderRadius: 20, padding: '32px 36px', marginBottom: 16,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ position: 'absolute', right: -120, top: -80, width: 420, height: 420, background: 'radial-gradient(circle at center, rgba(37,99,235,.12), transparent 60%)', pointerEvents: 'none' }}/>
        <span className="eyebrow"><i></i>晚上好，李思源</span>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '14px 0 8px', maxWidth: 700, lineHeight: 1.2 }}>
          昨晚练到 <span style={{ color: 'var(--brand)' }}>第 42 题</span>，今晚再用 42 分钟收尾。
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 540, lineHeight: 1.6, margin: '0 0 22px' }}>
          剩 88 题 · 资料分析 + 常识 · 按你昨晚的节奏 42 分钟可完成。
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn brand">继续练习 →</button>
          <button className="btn ghost">看今日数据</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Metric label="完成题量" value="184" delta="+56" hint="本周"/>
        <Metric label="平均正确率" value="78%" delta="+3%" hint="本周"/>
        <Metric label="连续打卡" value="12" hint="不要断哦"/>
        <Metric label="新增错题" value="14" delta="−8" hint="比上周少"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="sec-title">本周趋势</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>正确率走势 · 30 天</h3>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['7D','30D','全部'].map((t,i) => (
                <button key={t} className="btn tiny ghost" style={{ background: i===1 ? 'var(--brand-50)' : 'transparent', borderColor: i===1 ? 'var(--brand-200)' : 'var(--line)', color: i===1 ? 'var(--brand-700)' : 'var(--muted)' }}>{t}</button>
              ))}
            </div>
          </div>
          <div className="ph" style={{ height: 220 }}>折线图 · 正确率 30 天</div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="sec-title">推荐</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 14px' }}>今日为你推荐</h3>
          <ul className="check-list">
            <li>资料分析速算 · 30 题</li>
            <li>2024 国考行测 · 续做</li>
            <li>错题回顾 · 14 题</li>
            <li>申论一篇 · AI 批改</li>
          </ul>
          <button className="btn brand" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>开始今日推荐</button>
        </div>
      </div>
    </Shell>
  );
};

// =============================================================
// 方案 B：网格仪表盘 — 4×3 grid，数据驱动
// =============================================================
window.DashB = function DashB() {
  return (
    <Shell active="数据分析">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span className="sec-title">数据分析</span>
          <h2 style={{ fontSize: 26, fontWeight: 700, margin: '4px 0 0' }}>学习数据总览</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost tiny">导出 CSV</button>
          <button className="btn brand tiny">分享报告</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        <Metric label="累计题量" value="1,284" delta="+184" hint="本周"/>
        <Metric label="正确率" value="78%" delta="+3%"/>
        <Metric label="平均用时" value="58s" delta="−4s"/>
        <Metric label="活跃天数" value="47" hint="近 60 天"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>正确率趋势</h3>
            <span className="chip">↑ 3.2%</span>
          </div>
          <div className="ph" style={{ height: 180 }}>折线图</div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 10 }}>知识点掌握度</h3>
          <div className="ph" style={{ height: 180 }}>气泡图 / 雷达图</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 12 }}>各模块表现</h3>
          {[['言语理解',90],['判断推理',82],['常识',75],['数量关系',70],['资料分析',62]].map(([k,v]) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{k}</span>
                <span className="mono" style={{ color: v < 70 ? 'var(--danger)' : 'var(--ink)' }}>{v}%</span>
              </div>
              <div className="bar"><i style={{ width: `${v}%`, background: v < 70 ? 'var(--danger)' : 'var(--brand)' }}/></div>
            </div>
          ))}
        </div>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 12 }}>最近练习</h3>
          {[
            ['2024 国考·行测','42/100',62,'2h ago'],
            ['资料分析·速算','9/10',90,'昨天'],
            ['2023 浙江省考·申论','—','—','3 天前'],
            ['错题回顾','11/14',79,'4 天前'],
          ].map(([t,s,p,d],i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i<3 ? '1px solid var(--line)' : 'none' }}>
              <div className="icon-sq" style={{ width: 32, height: 32, fontSize: 12 }}>{['行','速','申','错'][i]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{d}</div>
              </div>
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{s}</span>
              <span className="chip" style={{ background: p === '—' ? 'var(--bg-alt)' : (p < 70 ? 'var(--danger-bg)' : 'var(--success-bg)'), color: p === '—' ? 'var(--muted)' : (p < 70 ? 'var(--danger)' : 'var(--success)'), borderColor: 'transparent' }}>{p === '—' ? '待批' : `${p}%`}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// =============================================================
// 方案 C：单焦点 hero — 一屏只讲一件事
// =============================================================
window.DashC = function DashC() {
  return (
    <Shell active="首页">
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', minHeight: 660, padding: '0 56px', position: 'relative' }}>
        <div style={{ position: 'absolute', right: 0, top: 40, width: 420, height: 420, background: 'radial-gradient(circle at center, rgba(37,99,235,.10), transparent 60%)', pointerEvents: 'none' }}/>
        <span className="eyebrow"><i></i>下一步</span>
        <h1 style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 18px', maxWidth: 800 }}>
          继续 <span style={{ color: 'var(--brand)' }}>2024 国考行测</span>，<br/>从第 42 题接着做。
        </h1>
        <p style={{ fontSize: 18, color: 'var(--muted)', maxWidth: 560, lineHeight: 1.6, margin: '0 0 32px' }}>
          剩 88 题 · 资料分析 + 常识 · 按你昨晚的节奏 42 分钟可完成。
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn brand lg">继续 →</button>
          <button className="btn ghost lg">看今日数据</button>
          <button className="btn ghost lg">换一套</button>
        </div>

        <div style={{ marginTop: 56, display: 'flex', gap: 56, paddingTop: 28, borderTop: '1px solid var(--line)', alignSelf: 'stretch', maxWidth: 800 }}>
          {[['78%','本周正确率'],['184','本周题量'],['12','天连击'],['197','天倒计时']].map(([v,l]) => (
            <div key={l}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// =============================================================
// 方案 D：跳出常规 — 「Daily Briefing」AI 主播式
// =============================================================
window.DashD = function DashD() {
  return (
    <Shell active="首页">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 左 — AI 主播简报卡 */}
        <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg, #0b1120, #1e293b)', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position:'absolute', right: -100, top: -100, width: 320, height: 320, background:'radial-gradient(circle, rgba(59,130,246,.4), transparent 60%)' }}/>
          <span className="eyebrow" style={{ background:'rgba(59,130,246,.2)', color:'#93c5fd', borderColor:'rgba(59,130,246,.3)' }}><i style={{ background:'#3b82f6' }}/>SIKAO BRIEFING · 今日</span>
          <h2 style={{ fontSize: 26, fontWeight: 700, margin: '16px 0 16px', lineHeight: 1.35 }}>
            上周资料分析连续走低，<br/>今天先做 <span style={{ color: '#60a5fa' }}>30 题速算专项</span>。
          </h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59,130,246,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>语音简报 · 1 分 28 秒</div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 2, marginTop: 6 }}>
                <div style={{ width: '32%', height: '100%', background: '#60a5fa', borderRadius: 2 }}/>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: '#94a3b8' }}>0:28 / 1:28</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, lineHeight: 1.9, color: '#cbd5e1' }}>
            <li><span style={{ color: '#60a5fa', marginRight: 8 }}>·</span>本周整体 78%，环比 +3%</li>
            <li><span style={{ color: '#60a5fa', marginRight: 8 }}>·</span>资料分析 62%，连续 3 天低于均线</li>
            <li><span style={{ color: '#60a5fa', marginRight: 8 }}>·</span>新增错题 14 道，集中在「增长率/比重」</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn brand">开始速算 30 题</button>
            <button className="btn ghost" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }}>稍后</button>
          </div>
        </div>

        {/* 右上 — 大字数据 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="sec-title">本周</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)' }}>78</span>
              <span style={{ fontSize: 24, color: 'var(--muted)', fontWeight: 600 }}>%</span>
              <span className="chip" style={{ marginLeft: 'auto' }}>+3% 环比</span>
            </div>
            <div className="ph" style={{ height: 80, marginTop: 12 }}>sparkline 7d</div>
          </div>
          <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>连续打卡</div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>12<span style={{ fontSize: 14, color: 'var(--muted)' }}> 天</span></div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>距 2026 国考</div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, marginTop: 6, color: 'var(--brand)' }}>197<span style={{ fontSize: 14, color: 'var(--muted)' }}> 天</span></div>
            </div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>本周打卡</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['一','二','三','四','五','六','日'].map((d,i)=>(
                <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 36, borderRadius: 8, background: i<5 ? 'var(--brand)' : (i===5 ? 'var(--brand-100)' : 'var(--bg-alt)'), display:'flex', alignItems:'center', justifyContent:'center', color: i<5 ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 600 }}>{i<5 ? '✓' : ''}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        {[
          ['增长率/比重','薄弱考点','12 题待练'],
          ['言语·近义辨析','已掌握','正确率 92%'],
          ['判断·类比推理','需巩固','上次 70%'],
        ].map(([t, k, sub], i) => (
          <div key={i} className="card hover" style={{ padding: 20 }}>
            <div className="icon-sq" style={{ width: 36, height: 36 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
            </div>
            <div style={{ fontSize: 11, color: i===0?'var(--danger)':(i===1?'var(--success)':'var(--warn)'), fontWeight: 600, marginTop: 12 }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{t}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
};

// =============================================================
// 方案 E：今日时间线（学习计划驱动）
// =============================================================
window.DashE = function DashE() {
  const slots = [
    { t: '07:00', a: '晨读 · 言语高频词', m: '15 分钟', done: true, type: '言语' },
    { t: '12:30', a: '速算 · 增长率 10 题', m: '20 分钟', done: true, type: '速算' },
    { t: '19:30', a: '续做 2024 国考行测', m: '60 分钟', main: true, type: '真题' },
    { t: '22:00', a: '错题回顾 · 14 题', m: '20 分钟', type: '错题' },
  ];
  return (
    <Shell active="学习计划">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <span className="sec-title">2026.04.26 · 周日</span>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 4px' }}>今日为你安排了 <span style={{ color: 'var(--brand)' }}>4 段</span> 学习</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>共 1 小时 55 分钟 · 已完成 2/4</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost tiny">调整计划</button>
          <button className="btn brand tiny">+ 新增任务</button>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 800 }}>
        <div style={{ position: 'absolute', left: 76, top: 0, bottom: 0, width: 2, background: 'var(--line)' }}/>
        {slots.map((s, i) => (
          <div key={i} style={{ position: 'relative', display: 'flex', gap: 28, paddingBottom: 18 }}>
            <div className="mono" style={{ width: 60, fontSize: 13, color: s.done ? 'var(--muted)' : 'var(--ink)', textAlign: 'right', paddingTop: 18, fontWeight: 600 }}>{s.t}</div>
            <div style={{ position: 'relative', width: 16 }}>
              <div style={{
                position: 'absolute', left: 1, top: 18, width: 14, height: 14, borderRadius: '50%',
                background: s.done ? 'var(--success)' : (s.main ? 'var(--brand)' : 'var(--paper)'),
                border: `2px solid ${s.done ? 'var(--success)' : (s.main ? 'var(--brand)' : 'var(--line-strong)')}`,
                boxShadow: '0 0 0 3px var(--bg-alt)',
              }}>
                {s.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 0, top: 0 }}><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            </div>
            <div className="card" style={{
              flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
              background: s.main ? 'var(--brand)' : (s.done ? 'var(--bg-alt)' : 'var(--paper)'),
              borderColor: s.main ? 'var(--brand)' : 'var(--line)',
              color: s.main ? '#fff' : 'var(--ink)',
              boxShadow: s.main ? 'var(--shadow-pop)' : 'none',
              opacity: s.done ? 0.7 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: .8, letterSpacing: '.04em', marginBottom: 4 }}>{s.type.toUpperCase()}</div>
                <div style={{ fontSize: s.main ? 18 : 15, fontWeight: 700, textDecoration: s.done ? 'line-through' : 'none' }}>{s.a}</div>
                <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>{s.m}</div>
              </div>
              {s.done ? (
                <span className="chip" style={{ background: 'transparent', color: 'var(--success)', borderColor: 'var(--success)' }}>已完成</span>
              ) : s.main ? (
                <button className="btn" style={{ background: '#fff', color: 'var(--brand)' }}>现在开始 →</button>
              ) : (
                <button className="btn ghost tiny">稍后</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
};

// =============================================================
// 方案 F：跳出常规 — 「考点星图」可视化导航
// =============================================================
window.DashF = function DashF() {
  // 模拟节点
  const nodes = [
    { x: 200, y: 140, r: 38, c: '#22c55e', l: '言语', s: '92%' },
    { x: 380, y: 220, r: 32, c: '#22c55e', l: '近义', s: '94%' },
    { x: 520, y: 110, r: 28, c: '#f59e0b', l: '类比', s: '78%' },
    { x: 280, y: 320, r: 30, c: '#22c55e', l: '判断', s: '82%' },
    { x: 460, y: 360, r: 44, c: '#dc2626', l: '资料', s: '62%' },
    { x: 620, y: 280, r: 26, c: '#dc2626', l: '增长率', s: '48%' },
    { x: 660, y: 420, r: 24, c: '#dc2626', l: '比重', s: '55%' },
    { x: 160, y: 440, r: 30, c: '#f59e0b', l: '常识', s: '75%' },
    { x: 360, y: 470, r: 26, c: '#f59e0b', l: '数量', s: '70%' },
  ];
  return (
    <Shell active="数据分析">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, height: 660 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: 'linear-gradient(180deg, #f8fafc, #fff)' }}>
          <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
            <div>
              <span className="sec-title">考点星图</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>你的知识掌握地图</h3>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="chip" style={{ background: '#dcfce7', color: '#16a34a', borderColor:'#bbf7d0' }}>掌握</span>
              <span className="chip warn">需巩固</span>
              <span className="chip danger">薄弱</span>
            </div>
          </div>
          <svg viewBox="0 0 800 600" style={{ width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#eff6ff"/>
                <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="400" cy="300" r="280" fill="url(#bg)"/>
            {/* 连线 */}
            {[[0,1],[1,2],[0,3],[1,4],[4,5],[4,6],[3,8],[7,8]].map(([a,b],i) => (
              <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 4"/>
            ))}
            {nodes.map((n,i) => (
              <g key={i} style={{ cursor:'pointer' }}>
                <circle cx={n.x} cy={n.y} r={n.r+6} fill={n.c} opacity="0.12"/>
                <circle cx={n.x} cy={n.y} r={n.r} fill="#fff" stroke={n.c} strokeWidth="2"/>
                <text x={n.x} y={n.y-2} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0b1120" fontFamily="Inter">{n.l}</text>
                <text x={n.x} y={n.y+12} textAnchor="middle" fontSize="11" fontWeight="600" fill={n.c} fontFamily="JetBrains Mono">{n.s}</text>
              </g>
            ))}
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 20, border: '2px solid var(--danger)', background: 'var(--danger-bg)' }}>
            <span className="chip danger">最薄弱 · 优先</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 4px' }}>资料分析 · 增长率</h3>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)', letterSpacing:'-0.02em' }}>48%</div>
            <p style={{ fontSize: 12, color: '#7f1d1d', margin: '6px 0 14px' }}>近 30 天 12 题 · 错 6 道</p>
            <button className="btn brand" style={{ width: '100%', justifyContent: 'center' }}>开始专项 30 题 →</button>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="sec-title">今日推送</div>
            <ul className="check-list" style={{ marginTop: 8 }}>
              <li>速算 30 题</li>
              <li>错题回顾 14 题</li>
              <li>申论一篇</li>
            </ul>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>距 2026 国考</div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: 'var(--brand)' }}>197 <span style={{ fontSize: 14, color: 'var(--muted)' }}>天</span></div>
            <div className="bar" style={{ marginTop: 10 }}><i style={{ width: '32%' }}/></div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>已备考 93 天 · 目标 290 天</div>
          </div>
        </div>
      </div>
    </Shell>
  );
};


window.Shell = Shell;
