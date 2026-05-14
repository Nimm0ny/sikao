/* global React */
// WrongBook + Profile + Bold + Mobile · marketing SaaS 风

// =============================================================
// 共享 sidebar (匹配 Dashboard.Shell)
// =============================================================
const ExtraShell = ({ active, children }) => (
  <div style={{ width: 1280, minHeight: 800, display: 'flex', background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
    {/* Reuse the global Sidebar from dashboard via window */}
    {window.Sidebar ? <window.Sidebar active={active}/> : <div style={{ width: 220, background: 'var(--paper)', borderRight: '1px solid var(--line)' }}/>}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {window.Topbar ? <window.Topbar/> : null}
      <main style={{ flex: 1, padding: '28px 36px', overflow: 'auto' }}>{children}</main>
    </div>
  </div>
);

// =============================================================
// WrongBook A — 列表式 + 高级筛选
// =============================================================
window.WrongA = function WrongA() {
  return (
    <ExtraShell active="错题本">
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <aside>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>筛选</span>
              <button className="btn ghost tiny" style={{ padding: '4px 8px', fontSize: 11 }}>清空</button>
            </div>
            {[
              { l: '模块', opts: ['言语', '判断', '常识', '数量', '资料'], sel: [0, 4] },
              { l: '错误类型', opts: ['知识盲区', '计算失误', '审题不清', '陷阱选项'], sel: [1] },
              { l: '掌握度', opts: ['未掌握', '需复习', '已掌握'], sel: [0, 1] },
              { l: '时间', opts: ['7 天', '30 天', '全部'], sel: [1] },
            ].map(g => (
              <div key={g.l} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{g.l}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.opts.map((o, i) => {
                    const on = g.sel.includes(i);
                    return <span key={o} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: on ? 600 : 500,
                      border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                      background: on ? 'var(--brand-50)' : 'transparent',
                      color: on ? 'var(--brand-700)' : 'var(--ink-muted)',
                      cursor: 'pointer',
                    }}>{o}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <span className="sec-title">错题本</span>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '4px 0 4px' }}>共 <span style={{ color: 'var(--brand)' }}>142</span> 题 · 待复习 87</h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>已选 0 项</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost tiny">全选</button>
              <button className="btn ghost tiny">导出</button>
              <button className="btn brand">开始复习 87 题 →</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {[
              { k: '资料分析 · 增长率', q: '2023 年 A 省制造业增加值占规上工业增加值的比重约为...', tag: '计算失误', n: 6, ago: '2 天前', mast: 'low' },
              { k: '判断推理 · 类比', q: '医生 : 病人 ? 教师 : ?', tag: '陷阱选项', n: 4, ago: '3 天前', mast: 'mid' },
              { k: '言语理解 · 片段阅读', q: '关于政府与市场在科技创新中的关系，下列论述与文段观点最契合的是...', tag: '审题不清', n: 3, ago: '5 天前', mast: 'mid' },
              { k: '数量关系 · 行程', q: '甲乙两车从 A 地相向而行，速度比 3:2，相遇后甲再走 24 分钟到 B...', tag: '知识盲区', n: 3, ago: '7 天前', mast: 'low' },
              { k: '资料分析 · 比重', q: '2023 年 A 省新能源汽车产量在汽车总产量中的占比变化值为...', tag: '计算失误', n: 2, ago: '12 天前', mast: 'high' },
            ].map((w, i) => {
              const dotColor = w.mast === 'low' ? 'var(--danger)' : w.mast === 'mid' ? 'var(--warn)' : 'var(--success)';
              const mastLabel = w.mast === 'low' ? '未掌握' : w.mast === 'mid' ? '需复习' : '已掌握';
              return (
                <div key={i} style={{ padding: '18px 22px', borderBottom: i < 4 ? '1px solid var(--line)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <input type="checkbox" style={{ marginTop: 4, width: 16, height: 16, accentColor: 'var(--brand)' }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      <span className="chip">{w.k}</span>
                      <span className="chip danger">{w.tag}</span>
                      <span className="chip muted">错 ×{w.n}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }}/>{mastLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{w.q}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }} className="mono">最近错于 {w.ago}</div>
                  </div>
                  <button className="btn ghost tiny">复习 →</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ExtraShell>
  );
};

// =============================================================
// WrongBook B — 卡牌堆叠（Anki 风）
// =============================================================
window.WrongB = function WrongB() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', position: 'relative' }}>
      <header style={{ height: 60, padding: '0 28px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn ghost tiny">← 退出</button>
          <div style={{ height: 22, width: 1, background: 'var(--line)' }}/>
          <span style={{ fontSize: 14, fontWeight: 700 }}>错题复习</span>
          <span className="chip">第 3 / 87 题</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}>🔥 连续 12 天</span>
          <button className="btn ghost tiny">设置</button>
        </div>
      </header>

      {/* 进度 */}
      <div style={{ padding: '14px 32px', background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
        <div className="bar"><i style={{ width: '3.4%' }}/></div>
      </div>

      {/* 卡牌堆 */}
      <div style={{ position: 'absolute', inset: '160px 0 120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[2, 1, 0].map(z => (
          <div key={z} className="card" style={{
            position: 'absolute',
            width: 680, padding: '32px 40px',
            transform: `translate(${z * 10}px, ${z * 10}px) scale(${1 - z * 0.03})`,
            opacity: z === 0 ? 1 : 0.5,
            zIndex: 3 - z,
            boxShadow: z === 0 ? 'var(--shadow-pop)' : 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <span className="chip">资料分析</span>
              <span className="chip muted">增长率</span>
              <span className="chip danger" style={{ marginLeft: 'auto' }}>错过 3 次</span>
            </div>
            <div style={{ fontSize: 20, lineHeight: 1.55, fontWeight: 500, marginTop: 8 }}>
              <span className="mono" style={{ color: 'var(--muted)', marginRight: 8 }}>118.</span>
              2023 年 A 省制造业增加值 18,400 亿元，同比增长 7.4%。则 2022 年制造业增加值约为？
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['17,134 亿', '17,082 亿', '18,234 亿', '19,762 亿'].map((o, i) => (
                <div key={i} className={`opt ${z === 0 && i === 1 ? 'wrong' : ''} ${z === 0 && i === 0 ? 'correct' : ''}`}>
                  <span className="k">{'ABCD'[i]}</span>{o}
                  {z === 0 && i === 0 && <span className="chip" style={{ marginLeft: 'auto', background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'transparent' }}>✓ 正确</span>}
                  {z === 0 && i === 1 && <span className="chip danger" style={{ marginLeft: 'auto' }}>你之前选的</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* SRS 按钮 */}
      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button className="btn ghost" style={{ minWidth: 150, padding: '14px 22px', borderColor: 'var(--danger)', color: 'var(--danger)', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>还不会</span>
          <span className="mono" style={{ fontSize: 10, opacity: .7 }}>明天再来</span>
        </button>
        <button className="btn ghost" style={{ minWidth: 150, padding: '14px 22px', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>有点印象</span>
          <span className="mono" style={{ fontSize: 10, opacity: .7 }}>3 天后</span>
        </button>
        <button className="btn brand" style={{ minWidth: 150, padding: '14px 22px', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>已掌握 →</span>
          <span className="mono" style={{ fontSize: 10, opacity: .7 }}>7 天后</span>
        </button>
      </div>
    </div>
  );
};

// =============================================================
// WrongBook C — 知识图谱式
// =============================================================
window.WrongC = function WrongC() {
  const nodes = [
    { x: 50, y: 30, r: 36, l: '资料分析', n: 12, hot: 'high' },
    { x: 25, y: 55, r: 26, l: '言语理解', n: 6, hot: 'mid' },
    { x: 75, y: 55, r: 30, l: '判断推理', n: 9, hot: 'high' },
    { x: 35, y: 80, r: 18, l: '数量关系', n: 3, hot: 'low' },
    { x: 65, y: 80, r: 14, l: '常识判断', n: 2, hot: 'low' },
  ];
  return (
    <ExtraShell active="错题本">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <span className="sec-title">错题本 · 知识图谱</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>你的弱项在这里</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>圆圈大小 = 错题数量；颜色 = 紧迫度</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['图谱', '列表', '热力'].map((t, i) => (
            <button key={t} className="btn tiny" style={{ background: i === 0 ? 'var(--ink)' : 'transparent', color: i === 0 ? '#fff' : 'var(--muted)', border: i === 0 ? 'none' : '1px solid var(--line)' }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div className="card" style={{ padding: 0, position: 'relative', height: 540, overflow: 'hidden' }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {/* connecting lines */}
            <line x1="50" y1="30" x2="25" y2="55" stroke="var(--line)" strokeWidth="0.15"/>
            <line x1="50" y1="30" x2="75" y2="55" stroke="var(--line)" strokeWidth="0.15"/>
            <line x1="25" y1="55" x2="35" y2="80" stroke="var(--line)" strokeWidth="0.15"/>
            <line x1="75" y1="55" x2="65" y2="80" stroke="var(--line)" strokeWidth="0.15"/>
            <line x1="35" y1="80" x2="65" y2="80" stroke="var(--line)" strokeWidth="0.15"/>
          </svg>
          {nodes.map((n, i) => {
            const color = n.hot === 'high' ? 'var(--danger)' : n.hot === 'mid' ? 'var(--warn)' : 'var(--success)';
            const bg = n.hot === 'high' ? 'var(--danger-bg)' : n.hot === 'mid' ? 'var(--warn-bg)' : 'var(--success-bg)';
            return (
              <div key={i} style={{
                position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%, -50%)',
                width: n.r * 2.4, height: n.r * 2.4,
                borderRadius: '50%', background: bg, border: `2px solid ${color}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}>
                {n.l}
                <span className="mono" style={{ fontSize: 11, color: color, marginTop: 2 }}>{n.n} 题</span>
              </div>
            );
          })}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--danger)', borderRadius: '50%', marginRight: 4 }}/>紧急</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--warn)', borderRadius: '50%', marginRight: 4 }}/>需巩固</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--success)', borderRadius: '50%', marginRight: 4 }}/>已稳定</span>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <span className="chip">已选</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 4px' }}>资料分析</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>12 道错题 · 紧急</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '14px 0' }}/>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>子分类</div>
          {[['增长率', 6], ['比重', 4], ['平均数', 2]].map(([k, n]) => (
            <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{k}</span><span className="mono" style={{ color: 'var(--danger)', fontWeight: 700 }}>×{n}</span>
              </div>
              <div className="bar" style={{ height: 4 }}><i style={{ width: `${n / 6 * 100}%`, background: 'var(--danger)' }}/></div>
            </div>
          ))}
          <button className="btn brand" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}>开始这 12 题 →</button>
        </div>
      </div>
    </ExtraShell>
  );
};

// =============================================================
// 个人中心 / 设置
// =============================================================
window.Profile = function Profile() {
  return (
    <ExtraShell active="设置">
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <nav>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10, padding: '0 12px' }}>设置</div>
          {['资料', '偏好', '通知', '数据', '订阅 ↗', '安全', '帮助'].map((x, i) => (
            <div key={x} style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 2, fontSize: 13,
              fontWeight: i === 0 ? 600 : 500,
              background: i === 0 ? 'var(--brand-50)' : 'transparent',
              color: i === 0 ? 'var(--brand-700)' : 'var(--ink-muted)',
              cursor: 'pointer',
            }}>{x}</div>
          ))}
        </nav>
        <div>
          <span className="sec-title">资料</span>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>个人资料</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 24px' }}>这些信息会用在你的报告抬头和分享卡片上。</p>

          <div className="card" style={{ padding: 22, marginBottom: 12, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, background: 'var(--brand)', color: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>李</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>李思源</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>SIKAO ID · A82C3F · 已加入 117 天</div>
            </div>
            <button className="btn ghost tiny">更换头像</button>
          </div>

          <div className="card" style={{ padding: 0, marginBottom: 16 }}>
            {[
              ['昵称', '李思源'],
              ['邮箱', 'lisiyuan@sikao.ai'],
              ['目标考试', '2026 国考（地市级）'],
              ['报考方向', '财政税务'],
              ['每日目标', '60 分钟'],
              ['考试日期', '2026.11.30'],
            ].map(([l, v], i, a) => (
              <div key={l} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', padding: '14px 22px', borderBottom: i < a.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{v}</span>
                <button className="btn ghost tiny" style={{ justifySelf: 'end' }}>编辑</button>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 22, background: 'linear-gradient(135deg, var(--ink) 0%, #1e293b 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(59,130,246,.3), transparent 70%)' }}/>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>思考 PRO · 季度会员</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>剩余 47 天</div>
              <div className="mono" style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>下次扣费 2026.06.12 · ¥99</div>
            </div>
            <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
              <button className="btn ghost" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}>管理</button>
              <button className="btn brand">续费 →</button>
            </div>
          </div>
        </div>
      </div>
    </ExtraShell>
  );
};

// =============================================================
// 跳出常规 — "学习手账" 双页
// =============================================================
window.BoldDiary = function BoldDiary() {
  return (
    <div style={{ width: 1280, height: 800, background: '#f5f1e8', fontFamily: 'var(--sans)', color: 'var(--ink)', padding: 40, position: 'relative', overflow: 'hidden' }}>
      {/* 装饰：背景纸纹 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 30%, rgba(59,130,246,.04), transparent 50%)' }}/>
      <div style={{ position: 'relative', height: '100%', background: 'var(--paper)', boxShadow: '0 20px 60px rgba(15,23,42,.12)', borderRadius: 8, display: 'flex', overflow: 'hidden' }}>
        {/* 左页 - 题目摘录 */}
        <div style={{ flex: 1, padding: 40, borderRight: '1px solid var(--line)', position: 'relative' }}>
          {/* 装订线 */}
          <div style={{ position: 'absolute', top: 32, bottom: 32, left: 64, width: 1, background: 'rgba(220,38,38,.18)' }}/>
          <div style={{ position: 'absolute', top: 32, bottom: 32, left: 70, width: 1, background: 'rgba(220,38,38,.18)' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}>DAY 117 · 04.26</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>P. 234</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 600, fontStyle: 'italic', margin: '4px 0 14px', fontFamily: 'Georgia, serif' }}>今日错的最痛的一题</h2>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', marginBottom: 18 }}/>

          <div style={{ paddingLeft: 32 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <span className="chip">#118</span>
              <span className="chip muted">资料 · 增长率</span>
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>
              2023 年 A 省制造业增加值 18,400 亿元，同比增长 7.4%。则 2022 年制造业增加值约为？
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-alt)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, display: 'flex', gap: 16 }}>
              <span><span className="mono" style={{ color: 'var(--danger)', fontWeight: 700 }}>我选 B</span> · 17,082</span>
              <span style={{ color: 'var(--line-strong)' }}>|</span>
              <span><span className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>正确 A</span> · 17,134</span>
            </div>
            <div style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--ink-muted)', marginTop: 18, lineHeight: 1.7, fontFamily: 'Georgia, serif', borderLeft: '3px solid var(--brand)', paddingLeft: 14 }}>
              "增长率不是直接除，是 a÷(1+r)。<br/>这一题，又错在同一个地方。"
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 10, height: 10, border: '1.5px solid var(--ink)', background: i <= 3 ? 'var(--danger)' : 'transparent', borderRadius: '50%' }}/>)}
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>错过 3 次</span>
            </div>
          </div>
        </div>

        {/* 右页 - 今日总结 */}
        <div style={{ flex: 1, padding: 40, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 32, bottom: 32, left: 64, width: 1, background: 'rgba(220,38,38,.18)' }}/>
          <div style={{ position: 'absolute', top: 32, bottom: 32, left: 70, width: 1, background: 'rgba(220,38,38,.18)' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="chip muted">04.26 · 周日</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>P. 235</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 600, fontStyle: 'italic', margin: '4px 0 14px', fontFamily: 'Georgia, serif' }}>今日小结</h2>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', marginBottom: 20 }}/>

          <div style={{ paddingLeft: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {[['题量', '56'], ['正确率', '71%'], ['用时', '1:12'], ['连续', '12 天']].map(([l, v]) => (
                <div key={l} style={{ padding: '12px 14px', background: 'var(--bg-alt)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{l}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Georgia, serif', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>明天的事</div>
            {['资料分析专项 30 题（增长率）', '重做 #118', '整套行测续做 88 题'].map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', fontSize: 14, alignItems: 'center', borderBottom: i < 2 ? '1px dashed var(--line)' : 'none' }}>
                <span style={{ width: 16, height: 16, border: '1.5px solid var(--ink)', borderRadius: 4, marginTop: 1 }}/>
                <span style={{ flex: 1 }}>{x}</span>
              </div>
            ))}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}>每日一句</span>
              <p style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--ink-muted)', marginTop: 10, lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>
                "今天比昨天多想一步。"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================
// 移动端 — 关键页
// =============================================================
window.MobileHome = function MobileHome() {
  return (
    <div style={{ width: 390, height: 844, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ padding: '60px 20px 100px', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div className="sec-title">2026.04.26 · 周日</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '4px 0 0' }}>晚上好，<span style={{ color: 'var(--brand)' }}>思源</span></h1>
          </div>
          <div style={{ width: 40, height: 40, background: 'var(--brand)', color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>李</div>
        </div>

        <div className="card" style={{ padding: 18, background: 'var(--ink)', color: '#fff', border: 'none', marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, background: 'radial-gradient(circle, rgba(59,130,246,.4), transparent 60%)' }}/>
          <div style={{ position: 'relative' }}>
            <span className="chip" style={{ background: 'rgba(59,130,246,.2)', color: '#93c5fd', borderColor: 'transparent' }}>继续</span>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>2024 国考行测 · 第 42 题</div>
            <div className="mono" style={{ fontSize: 11, opacity: .7, marginTop: 4 }}>剩 88 题 · ~42 min</div>
            <div className="bar" style={{ marginTop: 12, background: 'rgba(255,255,255,.15)' }}><i style={{ width: '32%', background: '#60a5fa' }}/></div>
            <button className="btn brand" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>继续 →</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
          {[['正确率', '78%'], ['本周', '184'], ['错题', '142'], ['连击', '12d']].map(([l, v]) => (
            <div key={l} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{l}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>AI 推荐</span>
          <span className="chip muted">3 项</span>
        </div>
        {[['资料速算 · 30 题', '弱项突破', true], ['言语高频 · 20 题', '15 分钟', false]].map(([t, m, hot]) => (
          <div key={t} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 11, color: hot ? 'var(--danger)' : 'var(--muted)', marginTop: 2 }}>{m}</div>
            </div>
            <span style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600 }}>开始 →</span>
          </div>
        ))}
      </div>

      {/* tabbar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'var(--paper)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-around', paddingTop: 10 }}>
        {[
          ['首页', <svg key="h" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>],
          ['题库', <svg key="b" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>],
          ['错题', <svg key="x" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>],
          ['我', <svg key="m" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
        ].map(([l, ic], i) => (
          <div key={l} style={{ textAlign: 'center', fontSize: 11, color: i === 0 ? 'var(--brand)' : 'var(--muted)', fontWeight: i === 0 ? 600 : 500 }}>
            {ic}
            <div style={{ marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.MobileSession = function MobileSession() {
  return (
    <div style={{ width: 390, height: 844, background: 'var(--paper)', fontFamily: 'var(--sans)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '52px 16px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn ghost tiny" style={{ padding: '4px 8px' }}>← 退出</button>
          <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}><span className="mono">00:42:18</span></span>
          <button className="btn ghost tiny" style={{ padding: '4px 8px' }}>⚑</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>言语 · 第 42 / 130</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>32%</span>
        </div>
        <div className="bar" style={{ marginTop: 6 }}><i style={{ width: '32%' }}/></div>
      </header>
      <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <span className="chip">片段阅读</span>
          <span className="chip muted">单选</span>
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.6, margin: '8px 0 18px', fontWeight: 500 }}>
          <span className="mono" style={{ color: 'var(--muted)', marginRight: 6 }}>42.</span>
          关于政府与市场在科技创新中的关系，下列论述与文段观点最契合的是：
        </div>
        {['政府要在创新中保持中立', '政府应当有所为有所不为', '政府应全面退出科技产业', '政府应主导关键产业'].map((o, i) => (
          <div key={i} className={`opt ${i === 1 ? 'selected' : ''}`} style={{ marginBottom: 8, padding: '14px 14px' }}>
            <span className="k">{'ABCD'[i]}</span>{o}
          </div>
        ))}
      </div>
      <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--paper)' }}>
        <button className="btn ghost" style={{ flex: 1, padding: 14, justifyContent: 'center' }}>← 上一题</button>
        <button className="btn brand" style={{ flex: 1.4, padding: 14, justifyContent: 'center' }}>下一题 →</button>
      </div>
    </div>
  );
};

window.MobileResult = function MobileResult() {
  const dash = 2 * Math.PI * 44;
  const offset = dash * (1 - 0.78);
  return (
    <div style={{ width: 390, height: 844, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', padding: '52px 16px 20px', overflow: 'auto' }}>
      <span className="sec-title">报告</span>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 16px' }}>2024 国考行测 · <span style={{ color: 'var(--brand)' }}>已完成</span></h1>
      <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-alt)" strokeWidth="6"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={offset} transform="rotate(-90 50 50)"/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mono" style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>78</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>/ 100</span>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--brand-50)', borderRadius: 8, color: 'var(--brand-700)', fontSize: 12, fontWeight: 600 }}>
          ↑ 高于 82% 的同期备考者
        </div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>分项准确率</div>
        {[['言语', 90], ['判断', 82], ['常识', 73], ['数量', 67], ['资料', 60]].map(([n, p]) => (
          <div key={n} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ fontWeight: 500 }}>{n}</span>
              <span className="mono" style={{ color: p < 70 ? 'var(--danger)' : 'var(--ink)', fontWeight: 700 }}>{p}%</span>
            </div>
            <div className="bar"><i style={{ width: `${p}%`, background: p < 70 ? 'var(--danger)' : 'var(--brand)' }}/></div>
          </div>
        ))}
      </div>
      <button className="btn brand" style={{ width: '100%', padding: 14, justifyContent: 'center' }}>逐题回顾 →</button>
    </div>
  );
};
