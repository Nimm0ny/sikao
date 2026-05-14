/* global React */
// PracticeSession wireframes — 答题中（多题型 + 多状态）· marketing SaaS 风
// 复用 dashboard.jsx 的 Topbar 不再适用 — 答题界面用专属 header

const SessionHeader = ({ title = '2024 国考行测', sub = '言语理解 · 第 42 / 130 题', flagged, time = '00:42:18' }) => (
  <header style={{
    height: 60, padding: '0 28px',
    background: 'var(--paper)', borderBottom: '1px solid var(--line)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <button className="btn ghost tiny" style={{ padding: '6px 10px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        退出
      </button>
      <div style={{ height: 22, width: 1, background: 'var(--line)' }}/>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
      <span className="chip muted">{sub}</span>
      {flagged && <span className="chip warn">⚑ 已标记</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span className="mono">{time}</span>
      </span>
      <button className="btn ghost tiny">⚑ 标记</button>
      <button className="btn ghost tiny">答题卡</button>
      <button className="btn brand tiny">交卷</button>
    </div>
  </header>
);

// =============================================================
// A：标准一题一屏 · 单选（带状态切换）
// =============================================================
window.SessionA = function SessionA({ state = 'unanswered' }) {
  const opts = [
    'A 政府要在创新中保持中立，不能介入市场具体决策',
    'B 政府在产业政策中应当有所为，亦应有所不为',
    'C 政府应当全面退出科技产业，由市场自发调节',
    'D 政府应当主导关键产业，决定研发方向',
  ];
  const selectedIdx = state === 'unanswered' ? -1 : 1;
  const cls = (i) => {
    if (state === 'correct' && i === 1) return 'opt correct';
    if (state === 'wrong' && i === 1) return 'opt wrong';
    if (state === 'wrong' && i === 0) return 'opt correct';
    if (i === selectedIdx) return 'opt selected';
    return 'opt';
  };
  const showSolution = state === 'correct' || state === 'wrong';

  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader flagged={state === 'flagged'}/>
      <div style={{ height: 3, background: 'var(--line)' }}>
        <div style={{ width: '32%', height: '100%', background: 'var(--brand)' }}/>
      </div>

      <main style={{ flex: 1, padding: '32px 56px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, overflow: 'auto' }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <span className="chip">言语理解</span>
            <span className="chip muted">片段阅读</span>
            <span className="chip muted">单选</span>
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.75, marginBottom: 28, color: 'var(--ink)' }}>
            <span className="mono" style={{ color: 'var(--muted)', marginRight: 10, fontSize: 16 }}>42.</span>
            关于政府与市场在科技创新中的关系，下列论述与文段观点最契合的是：
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opts.map((o, i) => (
              <div key={i} className={cls(i)}>
                <span className="k">{o[0]}</span>
                <span style={{ flex: 1 }}>{o.slice(2)}</span>
                {state === 'wrong' && i === 0 && <span className="chip" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'transparent' }}>正确</span>}
                {state === 'wrong' && i === 1 && <span className="chip danger">你的</span>}
                {state === 'correct' && i === 1 && <span className="chip" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'transparent' }}>✓ 正确</span>}
              </div>
            ))}
          </div>

          {showSolution && (
            <div style={{ marginTop: 24, padding: 24, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div className="icon-sq" style={{ width: 28, height: 28 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9.66 17a4 4 0 1 1 4.68 0M12 3v1M5.6 5.6l.7.7M3 12h1M19.4 5.6l-.7.7M21 12h-1M9 21h6"/></svg>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>解析</span>
                <span className="chip" style={{ marginLeft: 'auto' }}>正确率 64%</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink-muted)', margin: 0 }}>
                文段先承认市场的基础作用，又强调政府"有所为有所不为"的边界 — B 项最贴合。A 过度强调"中立"，C 与全文相反，D 是错误归纳。
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn ghost tiny">问 AI</button>
                <button className="btn ghost tiny">加入错题本</button>
                <button className="btn ghost tiny">看类似题</button>
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="card" style={{ padding: 18, marginBottom: 12 }}>
            <div className="sec-title">本节进度</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 700 }}>14</span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>/ 40 言语</span>
            </div>
            <div className="bar" style={{ marginTop: 10 }}><i style={{ width: '35%' }}/></div>
          </div>
          <div className="card" style={{ padding: 18, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>笔记</div>
            <div style={{
              minHeight: 140, padding: 12, fontSize: 13, color: 'var(--placeholder)',
              background: 'var(--bg-alt)', border: '1px dashed var(--line-strong)', borderRadius: 8,
              fontStyle: 'italic',
            }}>写下你对这道题的思考...</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }}>← 上一题</button>
            <button className="btn brand" style={{ flex: 1, justifyContent: 'center' }}>下一题 →</button>
          </div>
        </aside>
      </main>
    </div>
  );
};

// =============================================================
// B：材料题分栏（左材料 / 右多个小题）
// =============================================================
window.SessionB = function SessionB() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader sub="资料分析 · 第 116-120 题"/>
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, overflow: 'hidden' }}>
        <div className="card" style={{ padding: 24, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="sec-title">材料</span>
            <button className="btn ghost tiny">📌 固定</button>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-muted)' }}>
            <p style={{ margin: '0 0 12px' }}>2023 年，A 省全省规模以上工业增加值同比增长 6.2%，其中制造业增长 7.4%，电力、热力、燃气及水生产和供应业增长 0.8%。</p>
            <p style={{ margin: '0 0 12px' }}>分门类看：采矿业增加值 980 亿元，同比下降 2.1%；制造业增加值 18,400 亿元，同比增长 7.4%；电力、热力、燃气及水生产和供应业增加值 2,160 亿元，同比增长 0.8%。</p>
            <div className="ph" style={{ height: 160, margin: '12px 0' }}>表格 1 · 三大门类增加值</div>
            <p style={{ margin: '12px 0' }}>从主要工业产品产量看，钢材产量 12,200 万吨，同比增长 4.1%；水泥产量 9,800 万吨，同比下降 6.3%；汽车产量 482 万辆，同比增长 9.2%；其中新能源汽车产量 156 万辆，同比增长 38.7%。</p>
            <div className="ph" style={{ height: 140 }}>柱状图 · 主要产品产量同比</div>
          </div>
        </div>
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <span className="chip">第 {115 + n} 题</span>
                <span className="chip muted">单选</span>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>
                <span className="mono" style={{ color: 'var(--muted)', marginRight: 8 }}>{115 + n}.</span>
                2023 年 A 省{['制造业增加值占规上工业增加值的比重约为', '新能源汽车产量在汽车总产量中的占比约为', '下列产品中产量同比下降的有几种'][n - 1]}：
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['85%', '32%', '7%', '41%'].map((o, i) => (
                  <div key={i} className={`opt ${n === 1 && i === 0 ? 'selected' : ''}`} style={{ padding: '10px 12px', fontSize: 13 }}>
                    <span className="k" style={{ width: 18, height: 18, fontSize: 11 }}>{'ABCD'[i]}</span>
                    <span>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

// =============================================================
// C：图形推理
// =============================================================
window.SessionC = function SessionC() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader sub="判断推理 · 图形推理 · 第 78 题"/>
      <main style={{ flex: 1, padding: 28, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
        <div className="card" style={{ padding: 36, maxWidth: 880, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <span className="chip">判断推理</span>
            <span className="chip muted">图形推理</span>
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.65, margin: '0 0 24px' }}>
            <span className="mono" style={{ color: 'var(--muted)', marginRight: 8 }}>78.</span>
            把下面的六个图形分为两类，使每一类图形都有各自的共同特征或规律，分类正确的是：
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ width: 110, height: 110, border: '1px solid var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)', position: 'relative' }}>
                <span className="mono" style={{ position: 'absolute', top: 6, left: 8, fontSize: 11, color: 'var(--muted)' }}>{i}</span>
                <div style={{ width: 56, height: 56, background: i % 2 ? 'transparent' : 'var(--ink)', border: '2px solid var(--ink)', borderRadius: i <= 3 ? 0 : '50%', transform: i === 2 ? 'rotate(45deg)' : 'none' }}/>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['1,2,3 / 4,5,6', '1,3,5 / 2,4,6', '1,2,4 / 3,5,6', '1,4,6 / 2,3,5'].map((o, i) => (
              <div key={i} className={`opt ${i === 1 ? 'selected' : ''}`}>
                <span className="k">{'ABCD'[i]}</span>{o}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

// =============================================================
// D：底部抽屉答题卡（answer card overlay）
// =============================================================
window.SessionD = function SessionD() {
  const states = ['done','done','done','wrong','done','done','flag','done','done','done','done','flag','done','wrong','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','now'];
  while (states.length < 130) states.push('');
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--bg-alt)', fontFamily: 'var(--sans)', color: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
      <SessionHeader/>
      {/* 模糊背景：当前题目预览 */}
      <div style={{ padding: 32, opacity: .25, pointerEvents: 'none' }}>
        <div style={{ fontSize: 18 }}>42. 关于政府与市场在科技创新中的关系...</div>
      </div>

      {/* 抽屉 */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 16, top: 100,
        background: 'var(--paper)', borderRadius: 16,
        boxShadow: '0 -20px 60px rgba(15,23,42,.18)', padding: 28,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <span className="sec-title">答题卡</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 4px' }}>2024 国考行测 · <span style={{ color: 'var(--brand)' }}>第 42 题</span></h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>已完成 41 / 130 · 标记 2 · 错 2</p>
          </div>
          <span className="chip" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-100)' }}>剩余 00:42:18</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {[['言语', 40, 40], ['判断', 35, 35], ['常识', 15, 10], ['数量', 15, 5], ['资料', 25, 0]].map(([n, t, d]) => (
            <div key={n} className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{n}</div>
              <div style={{ marginTop: 4 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{d}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}> / {t}</span>
              </div>
              <div className="bar" style={{ marginTop: 8, height: 4 }}><i style={{ width: `${d / t * 100}%` }}/></div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 6 }}>
            {states.slice(0, 130).map((s, i) => {
              const base = { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 6, fontWeight: 600, position: 'relative', cursor: 'pointer' };
              let extra = { background: 'var(--bg-alt)', color: 'var(--placeholder)', border: '1px solid var(--line)' };
              if (s === 'done') extra = { background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-100)' };
              if (s === 'wrong') extra = { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' };
              if (s === 'flag') extra = { background: 'var(--warn-bg)', color: '#b45309', border: '1px solid #fde68a' };
              if (s === 'now') extra = { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)', boxShadow: '0 0 0 3px var(--brand-100)' };
              return (
                <div key={i} style={{ ...base, ...extra }}>
                  {i + 1}
                  {s === 'flag' && <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 10 }}>⚑</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 3 }}/>已答</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 3 }}/>错</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--warn-bg)', border: '1px solid #fde68a', borderRadius: 3 }}/>标记</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--brand)', borderRadius: 3 }}/>当前</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost">关闭</button>
            <button className="btn brand">交卷</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================
// E：跳出常规 — 极简专注模式
// =============================================================
window.SessionE = function SessionE() {
  return (
    <div style={{ width: 1280, height: 800, background: 'var(--paper)', fontFamily: 'var(--sans)', color: 'var(--ink)', position: 'relative' }}>
      {/* 顶部：极简进度条 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--bg-alt)' }}>
        <div style={{ width: '32%', height: '100%', background: 'var(--brand)' }}/>
      </div>
      <div style={{ position: 'absolute', top: 24, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', opacity: .5 }}>
        <span className="mono" style={{ fontSize: 12 }}>42 / 130 · 言语</span>
        <span className="mono" style={{ fontSize: 12 }}>00:42:18</span>
      </div>

      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 760 }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <span className="chip" style={{ display: 'inline-flex' }}>言语理解 · 片段阅读</span>
        </div>
        <div style={{ fontSize: 26, lineHeight: 1.5, textAlign: 'center', marginBottom: 36, fontWeight: 500, letterSpacing: '-0.01em' }}>
          关于政府与市场在科技创新中的关系，下列论述与文段观点最契合的是：
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['政府要在创新中保持中立', '政府应当有所为有所不为', '政府应全面退出科技产业', '政府应主导关键产业'].map((o, i) => (
            <div key={i} className="opt" style={{ padding: '20px 24px', fontSize: 15 }}>
              <span className="k" style={{ width: 28, height: 28, fontSize: 14 }}>{'ABCD'[i]}</span>{o}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 20, opacity: .5, fontSize: 11 }} className="mono">
        <span><kbd style={{ padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10 }}>←</kbd> 上一题</span>
        <span><kbd style={{ padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10 }}>SPACE</kbd> 标记</span>
        <span><kbd style={{ padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10 }}>↵</kbd> 提交</span>
        <span><kbd style={{ padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10 }}>→</kbd> 下一题</span>
        <span><kbd style={{ padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 10 }}>ESC</kbd> 退出</span>
      </div>
    </div>
  );
};
